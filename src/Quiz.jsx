import React from 'react';
import CheckAllThatApply from './CheckAllThatApply.jsx';
import FreeForm from './FreeForm.jsx';
import MultipleChoice from './MultipleChoice.jsx';
import TrueFalse from './TrueFalse.jsx';
import Submit from './Submit.jsx';
import Submitted from './Submitted.jsx';
import Timer from './Timer.jsx';

export default class Quiz extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
        this.state = {
            error: null,
            quizLoaded: false,
            quiz: {}
        }
    }
    
    componentDidMount() {
        let quizId = parseInt(window.location.pathname.split('/')[4]);
        
        try {
            if (isNaN(quizId)) {
                throw new Error('Invalid URL');
            }
        } catch (error) {
            this.setState({
                error: error
            });
        }
        
        let candidateId = 0;
        let pathName = new URL(window.location.href).pathname;
        let pathArr = pathName.split('/');
        for (let pathIndex = 0; pathIndex < pathArr.length; ++pathIndex) {
            if (pathArr[pathIndex] === 'candidate') {
                candidateId = pathArr[pathIndex + 1];
            }
        }
        
        try {
            if (candidateId === 0) {
                throw new Error('Invalid URL, invalid candidate id.');
            }
        } catch (error) {
            this.setState({
                error: error
            });
        }
        
        fetch(`/candidate/${candidateId}`)
            .then(res => res.json())
            .then(
                (result) => {
                    if (result.quizzes) {
                        let decodedQuizzes = JSON.parse(result.quizzes);
                        if (decodedQuizzes) {
                            for (let quiz of decodedQuizzes) {
                                if (parseInt(quiz.result.id) == parseInt(quizId)) {
                                    // quiz already submitted
                                    this.setState({
                                        alreadySubmitted: true,
                                        result: quiz.result,
                                        hasFreeForm: quiz.hasFreeForm
                                    });
                                }
                            }
                        }
                    }
                    
                    fetch(`${this.config.foreignHost}/quiz/${quizId}`)
                        .then(res => res.json())
                        .then(
                            (result) => {
                                this.setState({
                                    quizLoaded: true,
                                    quiz: result
                                });
                            },
                            (error) => {
                                this.setState({
                                    quizLoaded: true,
                                    error: error
                                });
                            }
                        );
                    
                    if (!this.state.alreadySubmitted) {
                        // start timer
                        fetch(`/timer/${candidateId}`, {method: "POST", body: null})
                            .then(res => res.json())
                            .then(
                                (result) => {
                                    this.setState({
                                        timerLoaded: true,
                                        timer: result
                                    });
                                },
                                (error) => {
                                    this.setState({
                                        timerLoaded: true,
                                        error: "Invalid timer"
                                    });
                                }
                            );
                    } else {
                        this.setState({
                            timerLoaded: true,
                            timer: 0
                        });
                    }
                },
                (error) => {
                    this.setState({
                        error: error
                    });
                }
            );
    }
    
    render() {
        if (this.state.error) {
            return <div>Error: {this.state.error}</div>;
        } else if (!this.state.quizLoaded || !this.state.timerLoaded) {
            return <div>Loading</div>;
        } else if (this.state.alreadySubmitted) {
            return (
                <React.Fragment>
                    <h1 className="quizTitle">{this.state.quiz.title}</h1>
                    <Submitted config={this.config} result={this.state.result} hasFreeForm={this.state.hasFreeForm} />
                </React.Fragment>
            );
        } else {
            let questions = this.state.quiz.question.map((question) => {
                let question_component = null;
                
                switch(question.type) {
                    case 1:
                        question_component = <TrueFalse key={question.id} config={this.config} question={question} />;
                        break;
                    case 2:
                        question_component = <MultipleChoice key={question.id} config={this.config} question={question} />;
                        break;
                    case 3:
                        question_component = <CheckAllThatApply key={question.id} config={this.config} question={question} />;
                        break;
                    case 4:
                        question_component = <FreeForm key={question.id} config={this.config} question={question} />;
                        break;
                    default:
                        question_component = null;
                }
                
                return question_component;
            });
            questions.push(
                <div key="nameInput" className="nameContainer">
                    <label htmlFor="candidateName">Enter your name:</label>
                    <input type="text" id="candidateName" name="candidateName" minLength="1" maxLength="64" required />
                </div>
            )
            return (
                <React.Fragment>
                    <h1 className="quizTitle">{this.state.quiz.title}</h1>
                    <Timer config={this.config} timer={this.state.timer} limit={this.state.quiz.timeLimit} />
                    <form method="post" className="quiz">
                        <div className="questions">{questions}</div>
                        <Submit key="submitBtn" config={this.config} />
                    </form>
                </React.Fragment>
            );
        }
    }
}
