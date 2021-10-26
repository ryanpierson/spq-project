const config = require('./config/config');
const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const mailgun = require('mailgun-js')({apiKey: config.mailgunApiKey, domain: config.mailgunDomain});

const app = express();

app.use(express.static('static'));
app.use(express.static('dist'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

const condenseSubmission = (body) => {
    let submission = {};
    
    for (const [questionId, submittedAnswer] of Object.entries(body)) {
        if (questionId === 'email') {
            continue;
        }
        if (questionId.includes('-')) {
            let idIndex = questionId.split('-');
            if (submission[idIndex[0]]) {
                submission[idIndex[0]].push(submittedAnswer);
            } else {
                submission[idIndex[0]] = [submittedAnswer];
            }
        } else {
            submission[questionId] = submittedAnswer;
        }
    }
    
    return submission;
}

const handleSubmission = (body, result) => {
    let submission = condenseSubmission(body);
    let hasFreeForm = false;
    
    for (let i = 0; i < result['question'].length; ++i) {
        result['question'][i].credit = 0;
        
        let id = result['question'][i].id;
        let type = result['question'][i].type;
        let storedAnswers = result['question'][i].answer;
        
        switch (type) {
            case 1: // true or false
                let submittedAnswer = false;
                if (submission[id] === 'true') {
                    submittedAnswer = true;
                }
                if (submittedAnswer === result['question'][i].answer) {
                    result['question'][i].credit = result['question'][i].points;
                }
                result['question'][i].submission = submittedAnswer;
                break;
            case 2: // multiple choice
                for (let j = 0; j < storedAnswers.length; ++j) {
                    if (submission[id] === storedAnswers[j].Answer && storedAnswers[j].Correct === true) {
                        result['question'][i].credit = result['question'][i].points;
                    }
                }
                result['question'][i].submission = submission[id];
                break;
            case 3: // check all that apply
                let correctCount = 0;
                for (let j = 0; j < submission[id].length; ++j) {
                    let answerCorrect = false;
                    for (let k = 0; k < storedAnswers.length; ++k) {
                        if (submission[id][j] === storedAnswers[k].Answer && storedAnswers[k].Correct === true) {
                            answerCorrect = true;
                        }
                    }
                    if (answerCorrect === true) {
                        ++correctCount;
                    } else {
                        --correctCount;
                    }
                }
                
                let possiblePoints = 0;
                for (let k = 0; k < storedAnswers.length; ++k) {
                    if (storedAnswers[k].Correct === true) {
                        ++possiblePoints;
                    }
                }
                
                result['question'][i].credit = Math.max(((correctCount / possiblePoints) * result['question'][i].points), 0);
                result['question'][i].submission = submission[id];
                break;
            case 4:
                hasFreeForm = true;
                result['question'][i].submission = submission[id];
                break;
        }
    }
    
    let totalCredit = 0;
    let possiblePoints = 0;
    
    for (let i = 0; i < result['question'].length; ++i) {
        totalCredit += result['question'][i].credit;
        possiblePoints += result['question'][i].points;
    }
    
    result.credit = totalCredit;
    result.points = possiblePoints;
    
    return {
        'result': result,
        'hasFreeForm': hasFreeForm,
        'email': body.email,
        'name': body.name
    };
}

const sendEmail = (employer, quiz, candidate) => {
    let emailBody = `${employer.name}, ${quiz.name} ${quiz.email} has submitted a quiz.`;
    
    if (quiz.hasFreeForm) {
        let evaluateLink = `${config.siteHost}/candidate/${candidate.id}/quiz/${quiz.id}`;
        emailBody += ` Visit this link to evaluate their free form responses: ${evaluateLink}`;
    }

    let emailData = {
        from: 'Software Programming Quiz <me@samples.mailgun.org>',
        to: employer.email,
        subject: 'Quiz submission',
        text: emailBody
    };
    
    mailgun.messages().send(emailData, (emailError, emailResponse) => {
        if (emailError) {
            next(emailError);
        } else {
            // Email sent successfully.
            console.log(emailResponse);
        }
    });
}

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
});

// get candidate
app.get('/candidate/:candidateId', (req, res, next) => {
    const key = datastore.key(['Candidate', parseInt(req.params.candidateId)]);
    datastore.get(key).then(
        (result) => {
            let [candidate] = result;
            res.status(200).json(candidate);
        },
        (error) => {
            next(error);
        }
    );
});


// get candidate ids for an employer
app.get('/employercandidates/:employerId', (req, res, next) => {
    const query = datastore.createQuery('Employer').filter('employerId', '=', req.params.employerId).limit(1);
    datastore.runQuery(query).then((result) => {
        let [employers] = result;
        if (employers.length) {
            let [employer] = employers;
            let candidates = [];
            try {
                candidates = JSON.parse(employer.candidates);
            } catch (error) {
            }
            res.status(200).json(candidates);
        } else {
            res.status(404).json({error: `Invalid employer ID: ${req.params.employerId}`});
        }
    });
});

// add candidate ids to an employer
app.post('/employercandidates/:employerId', (req, res, next) => {
    let candidateEmails = req.body;
    let promises = [];
    
    for (let i = 0; i < candidateEmails.length; ++i) {
        let candidateInsert = new Promise((resolve, reject) => {
            const query = datastore.createQuery('Candidate').filter('email', '=', candidateEmails[i]).limit(1);
            datastore.runQuery(query).then((result) => {
                let [candidates] = result;
                
                if (candidates.length) {
                    let [candidate] = candidates;
                    
                    // this is the candidate id
                    resolve(candidate[datastore.KEY].id);
                } else {
                    const newCandidateKey = datastore.key('Candidate');
                    
                    let newCandidate = {
                        'name': '',
                        'email': query.filters[0].val,
                        'quizzes': ''
                    };
                    
                    let newCandidateEntity = {
                        key: newCandidateKey,
                        excludeFromIndexes: ["quizzes"],
                        data: newCandidate,
                    };
                    
                    datastore.insert(newCandidateEntity).then(
                        (insertSuccess) => {
                            // Candidate inserted successfully.
                            resolve(newCandidateKey.id);
                        },
                        (insertError) => {
                            reject(insertError);
                        }
                    );
                }
            });
        });
        
        promises.push(candidateInsert);
    } 
     
    Promise.all(promises).then((values) => {
        const employerQuery = datastore.createQuery('Employer').filter('employerId', '=', req.params.employerId).limit(1);
        datastore.runQuery(employerQuery).then((result) => {
            let [employers] = result;
            if (employers.length) {
                let [employer] = employers;
                
                let candidates = [];
                try {
                    candidates = JSON.parse(employer.candidates);
                } catch (error) {
                }
                
                employer.candidates = candidates.concat(values.filter((value) => candidates.indexOf(value) < 0));
                employer.candidates = JSON.stringify(employer.candidates);
                
                const employerKey = datastore.key(['Employer', parseInt(employer[datastore.KEY].id)]);
        
                let employerEntity = {
                    key: employerKey,
                    data: employer,
                };
        
                datastore.update(employerEntity).then(
                    (updateSuccess) => {
                        // Employer updated successfully.
                        res.status(200).send("Success");
                    },
                    (updateError) => {
                        next(updateError);
                    }
                );
            } else {
                const newEmployerKey = datastore.key('Employer');
                
                let newEmployer = {
                    'candidates': JSON.stringify(values),
                    'employerId': req.params.employerId
                };
                
                let newEmployerEntity = {
                    key: newEmployerKey,
                    excludeFromIndexes: ["candidates"],
                    data: newEmployer,
                };
                
                datastore.insert(newEmployerEntity).then(
                    (insertSuccess) => {
                        // Employer inserted successfully.
                        res.status(200).send("Success");
                    },
                    (insertError) => {
                        next(insertError);
                    }
                );
            }
        });
    }).catch((error) => {
        next(error);
    });
});

// send evaluation html
app.get('/candidate/:candidateId/quiz/:quizId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/evaluate.html'));
});

// send quiz html
app.get('/employer/:employerId/quiz/:quizId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/quiz.html'));
});

// handle quiz submission
app.post('/employer/:employerId/quiz/:quizId', (req, res, next) => {
    fetch(`/quiz/${req.params.quizId}`)
    .then(quizRes => quizRes.json())
    .then(
        (quizResult) => {
            let quizData = handleSubmission(req.body, quizResult);
            fetch(`/employer/${req.params.employerId}`)
            .then(employerRes => employerRes.json())
            .then(
                (employerResult) => {
                    // check if candidate exists
                    // if exists, update quiz listings to include quizData
                    // insert quizData for candidate
                    let candidateEmail = quizData.email.toLowerCase();
                    let candidateName = quizData.name;
                    
                    const query = datastore.createQuery('Candidate').filter('email', '=', candidateEmail).limit(1);
                    datastore.runQuery(query).then((result) => {
                        let [candidates] = result;
                        if (candidates.length) {
                            let [candidate] = candidates;
                            
                            candidate.name = candidateName;
                    
                            // parse candidate's previous quizzes and add to the array
                            let candidateQuizzes = [];
                            try {
                                let candidateQuizzes = JSON.parse(candidate.quizzes);
                            } catch (error) {
                            }
                    
                            if (candidateQuizzes.length > 10) {
                                candidateQuizzes = []; // preventing large blobs
                            }
                    
                            candidateQuizzes.push(quizData);
                            // overwrite old value with new value
                            candidate.quizzes = JSON.stringify(candidateQuizzes);
                    
                            const existingCandidateKey = datastore.key(['Candidate', parseInt(candidate[datastore.KEY].id)]);
                    
                            let existingCandidateEntity = {
                                key: existingCandidateKey,
                                excludeFromIndexes: ["quizzes"],
                                data: candidate,
                            };
                            
                            // sendEmail(employerResult, quizData, candidate);
                    
                            datastore.update(existingCandidateEntity).then(
                                (updateSuccess) => {
                                    // Candidate updated successfully.
                                    res.status(200).send("Success");
                                },
                                (updateError) => {
                                    next(updateError);
                                }
                            );
                        } else {
                            const newCandidateKey = datastore.key('Candidate');
                            let newCandidate = {
                                'name': quizData.name,
                                'email': candidateEmail,
                                'name': candidateName,
                                'quizzes': JSON.stringify([quizData])
                            };
                    
                            let newCandidateEntity = {
                                key: newCandidateKey,
                                excludeFromIndexes: ["quizzes"],
                                data: newCandidate,
                            };
                            
                            // sendEmail(employerResult, quizData, newCandidate);
                    
                            datastore.insert(newCandidateEntity).then(
                                (insertSuccess) => {
                                    // Candidate inserted successfully.
                                    res.status(200).send("Success");
                                },
                                (insertError) => {
                                    next(insertError);
                                }
                            );
                        }
                    });
                },
                (employerError) => {
                    next(employerError);
                }
            );
        },
        (quizError) => {
            next(quizError);
        }
    );
    
    res.status(200).sendFile(path.resolve(__dirname, 'view/submitted.html'));
});

// mock endpoint
app.get('/employer/:employerId', (req, res) => {
    let employer = {
        'id': 1,
        'name': 'Test Employer',
        'email': 'osuspqtest@gmail.com',
        'quiz': []
    };
    res.json(employer);
});

// mock endpoint
app.get('/quiz/:quizId', (req, res) => {
    let trueFalse = {
        'id': '1',
        'type': 1,
        'points': 5,
        'question': 'Water is wet?',
        'answer': true
    };
    
    let multipleChoice = {
        'id': '2',
        'type': 2,
        'points': 6,
        'question': 'Which color?',
        'answer':  [
            {
                'Answer': 'Blue',
                'Correct': true
            },
            {
                'Answer': 'Green',
                'Correct': false
            },
            {
                'Answer': 'Red',
                'Correct': false
            }
        ]
    };
    
    let checkAllThatApply = {
        'id': '3',
        'type': 3,
        'points': 6,
        'question': 'How many?',
        'answer':  [
            {
                'Answer': '5',
                'Correct': true
            },
            {
                'Answer': '10',
                'Correct': true
            },
            {
                'Answer': '15',
                'Correct': false
            }
        ]
    };
    
    let freeForm = {
        'id': '4',
        'type': 4,
        'points': 7,
        'question': 'What is?',
        'answer': null
    };
    
    let questions = [trueFalse, multipleChoice, checkAllThatApply, freeForm];
    
    let quiz = {
        'id': req.params.quizId,
        'employee': '1',
        'time-limit': 60,
        'question': questions
    };
    
    res.json(quiz);
});

// mock question endpoint
app.get('/question/:questionId', (req, res) => {
    let question = null;
    
    switch (req.params.questionId) {
        case '1':
            question = {
                'id': '1',
                'type': 1,
                'points': 5,
                'question': 'Water is wet?',
                'answer': true
            };
            break;
        case '2':
            question = {
                'id': '2',
                'type': 2,
                'points': 6,
                'question': 'Which color?',
                'answer':  [
                    {
                        'Answer': 'Blue',
                        'Correct': true
                    },
                    {
                        'Answer': 'Green',
                        'Correct': false
                    },
                    {
                        'Answer': 'Red',
                        'Correct': false
                    }
                ]
            };
            break;
        case '3':
            question = {
                'id': '3',
                'type': 3,
                'points': 6,
                'question': 'How many?',
                'answer':  [
                    {
                        'Answer': '5',
                        'Correct': true
                    },
                    {
                        'Answer': '10',
                        'Correct': true
                    },
                    {
                        'Answer': '15',
                        'Correct': false
                    }
                ]
            };
            break;
        case '4':
            question = {
                'id': '4',
                'type': 4,
                'points': 7,
                'question': 'What is?',
                'answer': null
            };
            break;
        default:
            question = null;
    }
    
    res.json(question);
});

app.use((error, req, res, next) => {
    console.log(error);
    res.status(500).send('Error.');
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Express app listening on port ${PORT}`);
});

module.exports = app;
