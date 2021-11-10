import React from 'react';

export default class FreeForm extends React.Component {
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
                <div className="freeForm">
                    {this.question.question}
                    <textarea name={this.question.id}></textarea>
                </div>
            );
        }
    }
}
