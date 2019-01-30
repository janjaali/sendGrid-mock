import React from 'react';
import ReactDOM from 'react-dom';

class Mails extends React.Component {
    componentDidMount() {
        fetch('/api/mails')
            .then(response => {
                console.log(response);
            });
    }

    render() {
        return <h1>Mails</h1>;
    }
}

export default Mails;
