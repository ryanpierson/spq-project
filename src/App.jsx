import React from 'react';
import Quiz from './Quiz.jsx';

export default class App extends React.Component {
    constructor(props) {
        super(props);
        this.config = props.config;
    }
    
    render() {
        return (
            <React.Fragment>
                <div>{this.config.test}</div>
            </React.Fragment>
        );
    }
}
