import React from 'react';

export default class MultipleChoice extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
        this.question = props.question
        this.state = {
            error: null
        }
    }
    
    render() {
        if (this.state.error) {
            return <div>Error: {error.message}</div>;
        } else {
            let choices = this.question.answer.map((choice, index) => {
                return (
                    <label key={index}>
                        {choice.Answer}
                        <input type="radio" name={this.question.id + '-' + index} value={choice.Answer} />
                    </label>
                )
            });
            
            return (
                <div>
                    {this.question.question}
                    {choices}
                </div>
            );
        }
    }
}
