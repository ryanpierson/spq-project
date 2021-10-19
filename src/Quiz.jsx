import React from 'react';
import CheckAllThatApply from './CheckAllThatApply.jsx';
import FreeForm from './FreeForm.jsx';
import MultipleChoice from './MultipleChoice.jsx';
import TrueFalse from './TrueFalse.jsx';

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
        
        fetch(`http://192.168.33.10:8080/quiz/${quizId}`)
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
    }
    
    render() {
        if (this.state.error) {
            return <div>Error: {error.message}</div>;
        } else if (!this.state.isLoaded) {
            return <div>Loading</div>;
        } else {
            let questions = this.state.quiz.question.map(question => {
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
            return (
                <React.Fragment>
                    <form method="post">
                        <div>{questions}</div>
                        <div>
                            <input type="submit" value="Submit" />
                        </div>
                    </form>
                </React.Fragment>
            );
        }
    }
}
