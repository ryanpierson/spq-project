const path = require('path');

module.exports = {
    entry: path.resolve(__dirname, 'src/index.jsx'),
    mode: 'development',
    output: {
        filename: 'main.js',
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
