import React from 'react';
import CheckAllThatApply from './CheckAllThatApply.jsx';
import FreeForm from './FreeForm.jsx';
import MultipleChoice from './MultipleChoice.jsx';
import TrueFalse from './TrueFalse.jsx';
import Submit from './Submit.jsx';
import Timer from './Timer.jsx';

export default class Quiz extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
        this.state = {
            error: null,
            isLoaded: false,
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
                isLoaded: true,
                error: error
            });
        }
        
        fetch(`/quiz/${quizId}`)
            .then(res => res.json())
            .then(
                (result) => {
                    this.setState({
                        isLoaded: true,
                        quiz: result
                    });
                },
                (error) => {
                    this.setState({
                        isLoaded: true,
                        error: error
                    });
                }
            );
        
        let candidateId = 0;
        let pathName = new URL(window.location.href).pathname;
        let pathArr = pathName.split('/');
        for (let pathIndex = 0; pathIndex < pathArr.length; ++pathIndex) {
            if (pathArr[pathIndex] === 'candidate') {
                candidateId = pathArr[pathIndex + 1];
            }
        }
        
        // start timer
        fetch(`/timer/${candidateId}`, {method: "POST", body: null})
            .then(
                (result) => {
                },
                (error) => {
                    this.state.error = "Invalid timer"
                }
            );
    }
    
    render() {
        if (this.state.error) {
            return <div>Error: {this.state.error}</div>;
        } else if (!this.state.isLoaded) {
            return <div>Loading</div>;
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
                    <Timer config={this.config} timer={this.state.quiz.timeLimit} />
                    <form method="post" className="quiz">
                        <div className="questions">{questions}</div>
                        <Submit key="submitBtn" config={this.config} />
                    </form>
                </React.Fragment>
            );
        }
    }
}
