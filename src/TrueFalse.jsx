import React from 'react';

export default class TrueFalse extends React.Component {
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
            return (
                <div className="trueFalse border-top">
                    <u>{this.question.question}</u>
                    <label>
                        <input type="radio" name={this.question.id} value="true" />
                        True
                    </label>
                    <label>
                        <input type="radio" name={this.question.id} value="false" />
                        False
                    </label>
                </div>
            );
        }
    }
}
