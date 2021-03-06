import React from 'react';

export default class Submit extends React.Component {
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
                <div className="submitBtn">
                    <input className="btn btn-primary" type="submit" value="Submit"></input>
                </div>
            );
        }
    }
}
