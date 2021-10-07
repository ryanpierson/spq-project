const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('static'));
app.use(express.static('dist'));

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
})

// app.get('/', (req, res) => {
//     let dict = {};
// 
//     dict['testkey'] = 'testvalue';
// 
//     res.json(dict);
// })

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Express app listening on port ${PORT}`);
});

module.exports = app;
