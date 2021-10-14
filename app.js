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

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
});

app.get('/employer/:employerId/quiz/:quizId', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/quiz.html'));
});

app.post('/employer/:employerId/quiz/:quizId', (req, res) => {
    let promises = [];
    
    for (const [questionId, submittedAnswer] of Object.entries(req.body)) {
        let questionRequest = new Promise((resolve, reject) => {
            fetch(`http://192.168.33.10:8080/question/${questionId}`)
            .then(res => /*res.json()*/ throw new Error('test'))
            .then(
                (result) => {
                    // compare submittedAnswer to correct answer in result
                    // autograde what is possible then 
                    let answer = {
                        'submitted': submittedAnswer,
                        'result': result
                    };
                    resolve(answer);
                },
                (error) => {
                    let answer = {};
                    reject(answer);
                }
            );
        });
        
        promises.push(questionRequest);
    }
    
    Promise.all(promises).then(function(values) {
        // store submitted answers and whatever was autograded
        // send email to employer that candidate has submitted the quiz
        // include link to freeform evaluating interface if applicable
        
        console.log("success");
        console.log(values);
    }).catch(function(values) {
        console.log('catch');
        console.log(values);
    });
    
    res.status(200).sendFile(path.resolve(__dirname, 'view/submitted.html'));
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
    
    let freeForm = {
        'id': '3',
        'type': 4,
        'points': 7,
        'question': 'What is?',
        'answer': null
    };
    
    let questions = [trueFalse, multipleChoice, freeForm];
    
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

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Express app listening on port ${PORT}`);
});

module.exports = app;
