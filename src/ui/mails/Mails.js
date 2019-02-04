import React from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';

class Mails extends React.Component {
    constructor() {
        super();
        this.state = {
            mails: [],
        };
    }
    componentDidMount() {
        fetch('/api/mails')
            .then(data => (data.json()))
            .then(mails => {
                this.setState({ mails });
            });
    }

    render() {
        const data = this.state.mails;

        return <div>
            <ReactTable
                data={data}
                columns={[{
                    Header: 'Mails',
                    columns: [
                        {
                            Header: 'datetime',
                            id: 'datetime',
                            accessor: mail => mail.datetime
                        },
                        {
                            Header: 'from',
                            id: 'from',
                            accessor: mail => (mail.from ? mail.from.email : '')
                        },
                        {
                            Header: 'subject',
                            id: 'subject',
                            accessor: mail => mail.subject
                        },
                        {
                            Header: 'to',
                            id: 'to',
                            accessor: mail => mail.personalizations,
                            Cell: cellData => (cellData.value.map((value, index) => {
                                return (<span key={index}>{value.to.email}</span>);
                            }))
                        },
                        {
                            Header: 'content',
                            id: 'content',
                            accessor: mail => mail.content,
                            Cell: cellData => (cellData.value.map((value, index) => {
                                return (
                                    <div key={index}>
                                        <b>{value.type}</b><br />
                                        {value.value}
                                    </div>
                                );
                            }))
                        }
                    ]
                }]}
                className="-striped -highlight"
            />
        </div>;
    }
}

export default Mails;
