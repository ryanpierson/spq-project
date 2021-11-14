import React from 'react';

export default class Submitted extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
        this.state = {
            credit: props.result.credit,
            points: props.result.points,
            hasFreeForm: props.hasFreeForm,
            error: null
        }
    }
    
    render() {
        if (this.state.error) {
            return <div>Error: {error.message}</div>;
        } else if (this.state.hasFreeForm) {
            return (
                <div className="submitted">
                    <h2>This quiz has been submitted successfully.</h2>
                    <h3>Current score:</h3>
                    <h3>{this.state.credit} / {this.state.points}</h3>
                </div>
            );
        } else {
            return (
                <div className="submitted">
                    <h2>This quiz has already been submitted.</h2>
                    <h3>Current score:</h3>
                    <h3>{this.state.credit} / {this.state.points}</h3>
                </div>
            );
        }
    }
}
