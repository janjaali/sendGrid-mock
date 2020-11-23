import React from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';

class Mails extends React.Component {
    constructor() {
        super();
        this.state = {
            mails: [],
        };

        this.refresh = this.refresh.bind(this);
        this._fetchMails = this._fetchMails.bind(this);
    }

    componentDidMount() {
        this._fetchMails();
    }

    refresh() {
        this._fetchMails();
    }

    _fetchMails() {
        fetch('/api/mails')
            .then(data => (data.json()))
            .then(data => {
                data.forEach(m => {
                    if(m.personalizations[0].dynamic_template_data) {
                        m.displayContent = [
                            {
                                type: "template: "+ m.template_id, 
                                value: JSON.stringify(m.personalizations[0].dynamic_template_data)
                            }]
                    }
                    else
                    {
                        m.displayContent = m.content;
                    }
                });

                return data;
            })
            .then(mails => {
                this.setState({ mails });
            });
    }

    render() {
        const data = this.state.mails;

        return <div>
            <div style={{ textAlign: 'right' }}>
                <a href='#' onClick={this.refresh}>Refresh</a>
            </div>

            <ReactTable
                style={{ marginTop: '12px' }}
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
                            style: { 'whiteSpace': 'unset' },
                            accessor: mail => mail.subject
                        },
                        {
                            Header: 'to',
                            id: 'to',
                            accessor: mail => mail.personalizations,
                            Cell: cellData => (
                                cellData.value
                                    .filter(value => !!value.to)
                                    .map(value => value.to)
                                    .map((tos, index) => (
                                        <ul key={index}>
                                            {tos.map((to, index) =>
                                                (<li key={index}>{to.email}</li>))}
                                        </ul>)
                                    ))
                        },
                        {
                            Header: 'content',
                            id: 'content',
                            style: { 'whiteSpace': 'unset' },
                            accessor: mail => mail.displayContent,
                            Cell: cellData => (cellData.value.map((value, index) => {
                                return (
                                    <div key={index}>
                                        <b>{value.type}Test</b><br />
                                        <div dangerouslySetInnerHTML={{
                                            __html: value.value,
                                        }} />
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
