const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

app.use(express.static('static'));
app.use(express.static('dist'));
app.use(bodyParser.urlencoded({extended: true}));

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
    
    return {
        'result': result,
        'hasFreeForm': hasFreeForm,
        'email': body.email,
        'name': body.name
    };
}

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
});

app.get('/candidate/:candidateId', (req, res, next) => {
    let candidate = {
        'id': '1',
        'name': 'Test Candidate',
        'email': 'testcandidate@example.com',
        'quizzes': []
    };
    res.status(200).json(candidate);
});

app.get('/candidate/:candidateId/quiz/:quizId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/evaluate.html'));
});

app.get('/employer/:employerId/quiz/:quizId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/quiz.html'));
});

app.post('/employer/:employerId/quiz/:quizId', (req, res, next) => {
    fetch(`http://192.168.33.10:8080/quiz/${req.params.quizId}`)
    .then(quizRes => quizRes.json())
    .then(
        (quizResult) => {
            let quizData = handleSubmission(req.body, quizResult);
            fetch(`http://192.168.33.10:8080/employer/${req.params.employerId}`)
            .then(employerRes => employerRes.json())
            .then(
                (employerResult) => {
                    // check if candidate exists
                    // if exists, update quiz listings to include quizData
                    // insert quizData for candidate
                    let candidateEmail = quizData.email.toLowerCase();
                    
                    const query = datastore.createQuery('Candidate').filter('email', '=', candidateEmail).limit(1);
                    datastore.runQuery(query).then((result) => {
                        let [candidates] = result;
                        if (candidates.length) {
                            let [candidate] = candidates;
                            
                            // parse candidate's previous quizzes and add to the array
                            let candidateQuizzes = JSON.parse(candidate.quizzes);
                            
                            if (candidateQuizzes.length > 10) {
                                candidateQuizzes = []; // preventing large blobs
                            }
                            
                            candidateQuizzes.push(quizData);
                            // overwrite old value with new value
                            candidate.quizzes = JSON.stringify(candidateQuizzes);
                            
                            const existingCandidateKey = datastore.key('Candidate');

                            let existingCandidateEntity = {
                                key: existingCandidateKey,
                                data: candidate,
                            };
                            
                            datastore.update(existingCandidateEntity).then(
                                (updateSuccess) => {
                                    // Task updated successfully.
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
                                'quizzes': JSON.stringify([quizData])
                            };

                            let newCandidateEntity = {
                                key: newCandidateKey,
                                data: newCandidate,
                            };
                            
                            datastore.insert(newCandidateEntity).then(
                                (insertSuccess) => {
                                    // Task inserted successfully.
                                },
                                (insertError) => {
                                    next(insertError);
                                }
                            );
                        }
                    });
                    
                    // console.log(employerResult);
                    // send email to employer that candidate has submitted the quiz
                    // include link to freeform evaluating interface if applicable (quizData.hasFreeForm)
                    if (quizData.hasFreeForm) {
                        // let evaluate_link = `http://192.168.33.10:8080/candidate/${candidateId}/quiz/${req.params.employerId}`;
                    }
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

app.get('/employer/:employerId', (req, res) => {
    let employer = {
        'id': 1,
        'name': 'Test Employer',
        'email': 'test@gmail.com',
        'quiz': []
    };
    res.json(employer);
});

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


// following along with google tutorials
// const getTasks = () => {
//     const query = datastore
//         .createQuery('Task')
//         .limit(10);
// 
//         return datastore.runQuery(query);
// };
// 
// app.get('/dbtest', async (req, res, next) => {
//     try {
//         const [entities] = await getTasks();
//         console.log(entities);
//         res.json(entities);
//     } catch (error) {
//         next(error);
//     }
// });

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
