import React from 'react';

class Mails extends React.Component {
    componentDidMount() {
        fetch('/api/mails');
    }

    render() {
        return <h1>Mails</h1>;
    }
}

export default Mails;
