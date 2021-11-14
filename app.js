const config = require('./config/config');
const cors = require("cors");
const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const mailgun = require('mailgun-js')({apiKey: config.mailgunApiKey, domain: config.mailgunDomain});

const app = express();

app.use(cors());
app.use(express.static('static'));
app.use(express.static('dist'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

const condenseSubmission = (body) => {
    let submission = {};
    
    for (const [questionId, submittedAnswer] of Object.entries(body)) {
        if (questionId === 'email' || questionId === 'name') {
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
                    if (submission[id] === storedAnswers[j].answer && storedAnswers[j].correct === true) {
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
                        if (submission[id][j] === storedAnswers[k].answer && storedAnswers[k].correct === true) {
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
                    if (storedAnswers[k].correct === true) {
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
        'name': body.candidateName
    };
}

const sendEmail = (employerName, employerId, candidateName, candidateEmail, candidateId, quizId, hasFreeForm) => {
    let emailBody = `${employerName}, ${candidateName} ${candidateEmail} has submitted a quiz.`;
    
    if (hasFreeForm) {
        let evaluateLink = `https://quiz-app-467.herokuapp.com/employer/${employerId}/quiz/${quizId}/candidate/${candidateId}`;
        
        emailBody += ` Visit this link to evaluate their free form responses: ${evaluateLink}`;
    }
    
    let testEmail = 'osuspqtest@gmail.com';

    let emailData = {
        from: 'Software Programming Quiz <me@samples.mailgun.org>',
        // to: candidateEmail,
        to: testEmail,
        subject: 'Quiz submission',
        text: emailBody
    };
    
    mailgun.messages().send(emailData, (emailError, emailResponse) => {
        if (emailError) {
            throw emailError;
        } else {
            // Email sent successfully.
            console.log(emailResponse);
        }
    });
}

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
});

// get timer for candidate
app.get('/timer/:candidateId', (req, res, next) => {
    const query = datastore.createQuery('Timer').filter('candidateId', '=', req.params.candidateId).limit(1);
    datastore.runQuery(query).then((result) => {
        let [timers] = result;
        if (timers.length) {
            let [timer] = timers;
            res.status(200).send(timer.timer.toString());
        } else {
            // no timer for candidate
            res.status(404).send("No timer for candidate.");
        }
    });
});

// start timer for candidate
app.post('/timer/:candidateId', (req, res, next) => {
    const query = datastore.createQuery('Timer').filter('candidateId', '=', req.params.candidateId).limit(1);
    datastore.runQuery(query).then((result) => {
        let [timers] = result;
        if (timers.length) {
            let [timer] = timers;
            res.status(200).send(timer.timer.toString());
        } else {
            // no timer for candidate
            const newTimerKey = datastore.key('Timer');
            
            let timeStamp = Date.now();
            
            let newTimer = {
                'candidateId': req.params.candidateId,
                'timer': timeStamp
            };
            
            let newTimerEntity = {
                key: newTimerKey,
                data: newTimer,
            };
            
            datastore.insert(newTimerEntity).then(
                (insertSuccess) => {
                    // Timer inserted successfully.
                    res.status(200).send(timeStamp.toString());
                },
                (insertError) => {
                    next(insertError);
                }
            );
        }
    });
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

// post candidate
app.post('/candidate/:candidateId', (req, res, next) => {
    const candidateKey = datastore.key(['Candidate', parseInt(req.params.candidateId)]);
    
    const candidateQuery = datastore.createQuery('Candidate').filter('__key__', '=', candidateKey).limit(1);
    datastore.runQuery(candidateQuery).then((candidateResult) => {
        let [candidates] = candidateResult;
        if (candidates.length) {
            let [candidate] = candidates;
            const existingCandidateKey = datastore.key(['Candidate', parseInt(candidate[datastore.KEY].id)]);
            
            let existingCandidateEntity = {
                key: existingCandidateKey,
                excludeFromIndexes: ['quizzes'],
                data: req.body,
            };
            
            datastore.update(existingCandidateEntity).then(
                (updateSuccess) => {
                    // Candidate updated successfully.
                    let msg = {msg: "Success"};
                    res.status(200).json(msg);
                },
                (updateError) => {
                    next(updateError);
                }
            );
        } else {
            let msg = {error: "Candidate does not exist."};
            res.status(404).json(msg);
        }
    });
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
                    let candidateInfo = {};
                    candidateInfo[candidateEmails[i]] = candidate[datastore.KEY].id;
                    resolve(candidateInfo);
                } else {
                    const newCandidateKey = datastore.key('Candidate');
                    
                    let newCandidate = {
                        'name': '',
                        'email': candidateEmails[i],
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
                            let candidateInfo = {};
                            candidateInfo[candidateEmails[i]] = newCandidateKey.id;
                            resolve(candidateInfo);
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
                
                let candidateData = [];
                for (let candidateValue of values) {
                    let candidateObjectValues = Object.values(candidateValue);
                    if (!candidateObjectValues[0]) {
                        let badCandidateError = new Error('Invalid candidate.');
                        next(badCandidateError);
                    }
                    candidateData.push(candidateObjectValues[0]);
                }
                
                employer.candidates = candidates.concat(candidateData.filter((value) => candidates.indexOf(value) < 0));
                employer.candidates = JSON.stringify(employer.candidates);
                
                const employerKey = datastore.key(['Employer', parseInt(employer[datastore.KEY].id)]);
        
                let employerEntity = {
                    key: employerKey,
                    data: employer,
                };
        
                datastore.update(employerEntity).then(
                    (updateSuccess) => {
                        // Employer updated successfully.
                        let returnData = Object.assign(...values);
                        res.status(200).json(returnData);
                    },
                    (updateError) => {
                        next(updateError);
                    }
                );
            } else {
                const newEmployerKey = datastore.key('Employer');
                
                let candidateData = [];
                for (let candidateValue of values) {
                    let candidateObjectValues = Object.values(candidateValue);
                    if (!candidateObjectValues[0]) {
                        let badCandidateError = new Error('Invalid candidate.');
                        next(badCandidateError);
                    }
                    candidateData.push(candidateObjectValues[0]);
                }
                
                let newEmployer = {
                    'candidates': JSON.stringify(candidateData),
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
                        let returnData = Object.assign(...values);
                        res.status(200).json(returnData);
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
app.get('/employer/:employerId/quiz/:quizId/candidate/:candidateId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/quiz.html'));
});

// handle quiz submission
app.post('/employer/:employerId/quiz/:quizId/candidate/:candidateId', (req, res, next) => {
    let quizPath = `${config.foreignHost}/quiz/${req.params.quizId}`;
    console.log("TEST");
    console.log(quizPath);
    fetch(`${config.foreignHost}/quiz/${req.params.quizId}`)
    .then(quizRes => quizRes.json())
    .then(
        (quizResult) => {
            const findTimerQuery = datastore.createQuery('Timer').filter('candidateId', '=', req.params.candidateId).limit(1);
            datastore.runQuery(findTimerQuery).then(
                (findTimerResult) => {
                    let [timers] = findTimerResult;
                    if (timers.length) {
                        let [timer] = timers;
                        let quizData = handleSubmission(req.body, quizResult);
                        fetch(`${config.foreignHost}/employer/${req.params.employerId}`)
                            .then(employerRes => employerRes.json())
                            .then(
                                (employerResult) => {
                                    // check if candidate exists
                                    // if exists, update quiz listings to include quizData
                                    // insert quizData for candidate
                                    let candidateName = quizData.name;
                                    
                                    const candidateKey = datastore.key(['Candidate', parseInt(req.params.candidateId)]);
                                    
                                    const candidateQuery = datastore.createQuery('Candidate').filter('__key__', '=', candidateKey).limit(1);
                                    datastore.runQuery(candidateQuery).then((candidateResult) => {
                                        let [candidates] = candidateResult;
                                        if (candidates.length) {
                                            let [candidate] = candidates;
                                            
                                            candidate.name = candidateName;
                                            
                                            let timeLimit = quizData.result.timeLimit * 60 * 1000; // quiz time limit in milliseconds
                                            let timeElapsed = Date.now() - timer.timer;
                                            
                                            if (timeElapsed < timeLimit) {
                                                quizData.result.onTime = true;
                                            } else {
                                                quizData.result.onTime = false;
                                            }
                                            
                                            // delete timer
                                            const timerQuery = datastore.createQuery('Timer').filter('candidateId', '=', req.params.candidateId).limit(1);
                                            datastore.runQuery(timerQuery).then((timerResult) => {
                                                let [timers] = timerResult;
                                                if (timers.length) {
                                                    let [timer] = timers;
                                                    let timerKey = datastore.key(['Timer', parseInt(timer[datastore.KEY].id)]);
                                                    datastore.delete(timerKey);
                                                    
                                                    // parse candidate's previous quizzes and add to the array
                                                    let candidateQuizzes = [];
                                                    try {
                                                        candidateQuizzes = JSON.parse(candidate.quizzes);
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
                                                        excludeFromIndexes: ['quizzes'],
                                                        data: candidate,
                                                    };
                                                    
                                                    try {
                                                        sendEmail(employerResult.name, req.params.employerId, quizData.name, candidate.email, req.params.candidateId, req.params.quizId, quizData.hasFreeForm);
                                                    } catch (mailError) {
                                                        next(mailError);
                                                    }
                                                    
                                                    datastore.update(existingCandidateEntity).then(
                                                        (updateSuccess) => {
                                                            // Candidate updated successfully.
                                                            res.status(200).sendFile(path.resolve(__dirname, 'view/quiz.html'));
                                                        },
                                                        (updateError) => {
                                                            next(updateError);
                                                        }
                                                    );
                                                } else {
                                                    res.status(404).send(`Invalid submission, there is no timer set for candidate ${req.params.candidateId}`);
                                                }
                                            });
                                        } else {
                                            res.status(404).send("Candidate does not exist.");
                                        }
                                    });
                                },
                                (employerError) => {
                                    next(employerError);
                                }
                            );
                    } else {
                        // no timer for candidate
                        res.status(404).send(`Invalid submission, there is no timer set for candidate ${req.params.candidateId}`);
                    }
                },
                (findTimerError) => {
                    next(findTimerError);
                }
            );
        },
        (quizError) => {
            next(quizError);
        }
    );
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
    let quiz = {
        "id": "5763672618041344",
        "employee": "5639966621171712",
        "timeLimit": 1,
        "question": [
            {
                "type": 1,
                "answer": true,
                "question": "Is 2 + 2 equal to 4?",
                "id": "6202916574593024",
                "points": 5,
                "self": "https://cs467quizcreation.wl.r.appspot.com/question/6202916574593024"
            },
            {
                "points": 5,
                "type": 2,
                "id": "5632418417475584",
                "answer": [
                    {
                        "answer": "4",
                        "correct": true
                    },
                    {
                        "answer": "1",
                        "correct": false
                    }
                ],
                "self": "https://cs467quizcreation.wl.r.appspot.com/question/5632418417475584",
                "question": "What is 2 + 2?"
            },
            {
                "type": 3,
                "points": 5,
                "self": "https://cs467quizcreation.wl.r.appspot.com/question/5721280955285504",
                "id": "5721280955285504",
                "question": "Is math cool?",
                "answer": [
                    {
                        "correct": true,
                        "answer": "yes"
                    },
                    {
                        "correct": true,
                        "answer": "it's ok"
                    },
                    {
                        "correct": false,
                        "answer": "no"
                    }
                ]
            },
            {
                "id": "5157873420075008",
                "type": 4,
                "points": 5,
                "self": "https://cs467quizcreation.wl.r.appspot.com/question/5157873420075008",
                "question": "Is math cool?",
                "answer": null
            }
        ],
        "title": "Test Quiz",
        "self": "https://cs467quizcreation.wl.r.appspot.com/quiz/5763672618041344"
    };
    
    res.json(quiz);
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
