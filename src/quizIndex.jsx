import React from 'react';
import ReactDOM from 'react-dom';
import Quiz from './Quiz.jsx';
import config from './config.js';


ReactDOM.render(
    <Quiz config={config} />,
    document.getElementById('root')
);
