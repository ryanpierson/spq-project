const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('static'));
app.use(express.static('dist'));

const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

app.get('/', (req, res) => {
    res.status(200).sendFile(path.resolve(__dirname, 'view/index.html'));
});


// following along with google tutorials
const getTasks = () => {
    const query = datastore
        .createQuery('Task')
        .limit(10);

        return datastore.runQuery(query);
};

app.get('/dbtest', async (req, res, next) => {
    try {
        const [entities] = await getTasks();
        console.log(entities);
        res.json(entities);
    } catch (error) {
        next(error);
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Express app listening on port ${PORT}`);
});

module.exports = app;
