import React from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import PopUp from "./popup"; 

class Mails extends React.Component {
    constructor() {
        super();
        this.state = {
            mails: [],
            currentEmail: null
        };

        this.refresh = this.refresh.bind(this);
        this.filterOnEmailTo = this.filterOnEmailTo.bind(this);
        this._fetchMails = this._fetchMails.bind(this);
    }

    componentDidMount() {
        this._fetchMails();
    }

    refresh() {
        this._fetchMails();
    }

    filterOnEmailTo(event) {
        if(event.target.value.length > 3) {
            this._fetchMails(`to=%${event.target.value}%`);
        } else if (event.target.value.length < 1) {
            this._fetchMails();
        }
    }

    _fetchMails(query = '') {
        const queryString = `${query}&page=0&pageSize=100`
        fetch(`/api/mails?${queryString}`)
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
        const setCurrentEmail = email => {
            this.state.currentEmail = email;
            this.forceUpdate();
        }

        const hide = () => {
            this.state.currentEmail = null;
            this.forceUpdate();
        }

        const data = this.state.mails;
        const currentEmail = this.state.currentEmail;

        return <div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', marginRight: '5px' }}>
                    <label>Filter on to:&nbsp;</label>
                    <input type="search" onChange={this.filterOnEmailTo} />
                </div>
                <a href='#' onClick={this.refresh}>Refresh</a>
            </div>

            {currentEmail ? <PopUp currentEmail={currentEmail} hide={hide} /> : null }

            <ReactTable
                style={{ marginTop: '12px' }}
                data={data}
                showPageSizeOptions={false}
                columns={[{
                    Header: 'Mails',
                    columns: [
                        {
                            Header: 'datetime',
                            id: 'datetime',
                            headerStyle: {textAlign: 'left'},
                            width: 220,
                            accessor: mail => mail.datetime
                        },
                        {
                            Header: 'from',
                            id: 'from',
                            headerStyle: {textAlign: 'left'},
                            width: 220,
                            accessor: mail => (mail.from ? mail.from.email : '')
                        },
                        {
                            Header: 'subject',
                            id: 'subject',
                            headerStyle: {textAlign: 'left'},
                            style: { 'whiteSpace': 'unset' },
                            minWidth: 200,
                            accessor: mail => mail.subject
                        },
                        {
                            Header: 'to',
                            id: 'to',
                            headerStyle: {textAlign: 'left'},
                            accessor: mail => mail.personalizations,
                            Cell: cellData => (
                                cellData.value
                                    .filter(value => !!value.to)
                                    .map(value => value.to)
                                    .map((tos, index) => (
                                        <span key={index}>
                                            {tos.map((to, index) => 
                                                (<span key={index}>{to.email}</span> ))}
                                        </span>)
                                    ))
                        },
                        {
                            Header: 'Actions',
                            id: 'content',
                            headerStyle: {textAlign: 'left'},
                            style: { 'whiteSpace': 'unset' },
                            accessor: mail => mail.displayContent,
                            Cell: cellData => (
                                    <div>
                                         <a onClick={() => setCurrentEmail(cellData.value.find(mimeTypeEmails => mimeTypeEmails.type="text/html").value)}><b>Show email</b></a>&nbsp;<br />
                                    </div>
                                )
                        }
                    ]
                }]}
                className="-striped -highlight"
            />
        </div>;
    }
}

export default Mails;
