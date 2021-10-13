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
                <div>
                    {this.question.question}
                    <label>
                        True
                        <input type="radio" name={this.question.id} value="true" />
                    </label>
                    <label>
                        False
                        <input type="radio" name={this.question.id} value="false" />
                    </label>
                </div>
            );
        }
    }
}
