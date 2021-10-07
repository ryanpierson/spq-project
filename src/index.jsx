import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';
import config from './config.js';


ReactDOM.render(
    <App config={config} />,
    document.getElementById('root')
);
