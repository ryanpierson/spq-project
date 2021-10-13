const path = require('path');

module.exports = {
    entry: {
        index: path.resolve(__dirname, 'src/index.jsx'),
        quiz: path.resolve(__dirname, 'src/quizIndex.jsx'),
    },
    mode: 'development',
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist/'),
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        'cacheDirectory': true,
                        'cacheCompression': false,
                        envName: 'development'
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx']
    }
};
