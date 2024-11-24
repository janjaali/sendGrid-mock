import React from 'react';
import ReactTable from 'react-table';
import 'react-table/react-table.css';

import PopUp from './PopUp';

class Mails extends React.Component {
  constructor() {
    super();
    const queryParams = new URLSearchParams(location.search);
    this.state = {
      mails: [],
      currentEmail: null,
      subject: queryParams.get('subject') || '',
      to: queryParams.get('to') || '',
      dateTimeSince: queryParams.get('dateTimeSince') || '',
    };

    this.lastQuery = '';

    this.refresh = this.refresh.bind(this);
    this._filterEmailTo = this._filterEmailTo.bind(this);
    this._filterEmailSubject = this._filterEmailSubject.bind(this);
    this._fetchMails = this._fetchMails.bind(this);
    this.deleteAllMails = this.deleteAllMails.bind(this);
  }

  componentDidMount() {
    this._fetchMails();
  }

  deleteAllMails() {

    console.info('Command to delete all mails.');

    fetch('/api/mails', {method: 'DELETE'})
      .then(response => {
        if (response.status === 202) {
          console.info('All mails were deleted.');
          this.setState({ mails: [] });
        } else {
          console.error('Failed to delete all mails.', response);
        }
      });
  }

  refresh() {
    this._fetchMails();
  }

  _filterEmailTo(event) {
    this.state.to = event.target.value;
    this.forceUpdate();
    this._fetchMails();
  }

  _filterEmailSubject(event) {
    this.state.subject = event.target.value;
    this.forceUpdate();
    this._fetchMails();
  }

  _fetchMails() {
    const apiParams = new URLSearchParams('page=1&pageSize=100');
    const uiParams = new URLSearchParams(location.search);

    uiParams.forEach((key, value) => apiParams.set(key, value));

    if (this.state.to.length > 3) {
      apiParams.set('to', `%${this.state.to}%`);
    }
    if (this.state.subject.length > 3) {
      apiParams.set('subject', `%${this.state.subject}%`);
    }
    if(this.state.dateTimeSince.length > 4) {
      apiParams.set('dateTimeSince', `${this.state.dateTimeSince}`);
    }


    if (apiParams.toString() == this.lastQuery) return;

    this.lastQuery = apiParams.toString();
    fetch(`/api/mails?${this.lastQuery}`)
      .then(data => (data.json()))
      .then(data => {
        data.forEach(m => {
          if (m.personalizations[0].dynamic_template_data) {
            m.displayContent = [
              {
                type: 'template: ' + m.template_id,
                value: JSON.stringify(m.personalizations[0].dynamic_template_data)
              }];
          }
          else {
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
    const setCurrentEmail = (email, type) => {
      this.state.currentEmail = email;
      this.state.type = type;
      this.forceUpdate();
    };

    const hide = () => {
      this.state.currentEmail = null;
      this.state.type = null;
      this.forceUpdate();
    };

    const data = this.state.mails;
    const currentEmail = this.state.currentEmail;
    const selectedEmailType = this.state.type;

    return (

      <>
        <div style={{textAlign: 'center'}}>
          <h1>SENDGRID-MOCK</h1>
        </div>

        <div style={{ marginTop: '36px'}}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', marginRight: '5px' }}>
              <label>Filter on subject:&nbsp;</label>
              <input type="search" onChange={this._filterEmailSubject} value={this.state.subject} />
            </div>
            <div style={{ display: 'inline-block', marginRight: '5px' }}>
              <label>Filter on to:&nbsp;</label>
              <input type="search" onChange={this._filterEmailTo} value={this.state.to} />
            </div>
            <a href='#' onClick={this.refresh}>Refresh</a>
          </div>

          {currentEmail ? <PopUp currentEmail={currentEmail} selectedEmailType={selectedEmailType} hide={hide}/> : null}

          <ReactTable
            style={{ marginTop: '12px' }}
            data={data}
            showPageSizeOptions= {true}
            pageSizeOptions= {[10, 20, 50, 100]}
            defaultPageSize= {10}
            columns={[{
              Header: 'Mails',
              columns: [
                {
                  Header: 'datetime',
                  id: 'datetime',
                  headerStyle: { textAlign: 'left' },
                  width: 220,
                  accessor: mail => mail.datetime
                },
                {
                  Header: 'from',
                  id: 'from',
                  headerStyle: { textAlign: 'left' },
                  width: 220,
                  accessor: mail => (mail.from ? mail.from.email : '')
                },
                {
                  Header: 'subject',
                  id: 'subject',
                  headerStyle: { textAlign: 'left' },
                  style: { 'whiteSpace': 'unset' },
                  minWidth: 200,
                  accessor: mail => mail.subject
                },
                {
                  Header: 'to',
                  id: 'to',
                  headerStyle: { textAlign: 'left' },
                  accessor: mail => mail.personalizations,
                  Cell: cellData => (
                    cellData.value
                      .filter(value => !!value.to)
                      .map(value => value.to)
                      .map((tos, index) => (
                        <div key={index}>
                          {tos.length > 1
                            ? <ul>
                              {tos.map((to, subIndex) => (<li key={subIndex}>{to.email}</li>))}
                            </ul>
                            : <span>{tos[0].email}</span>
                          }
                        </div>)
                      ))
                },
                {
                  Header: 'Actions',
                  id: 'content',
                  headerStyle: { textAlign: 'left' },
                  style: { 'whiteSpace': 'unset' },
                  accessor: mail => mail,
                  Cell: cellData => (
                    <div>
                      {cellData.value.template_id
                        ? <a onClick={() => setCurrentEmail(cellData.value)}><b>Show template</b></a>
                        : <span>
                          <a onClick={() => setCurrentEmail(cellData.value, 'text/plain')}><b>Show plain text email</b></a>&nbsp;|&nbsp;
                          <a onClick={() => setCurrentEmail(cellData.value, 'text/html')}><b>Show html email</b></a>&nbsp;<br />
                        </span>
                      }
                    </div>
                  )
                }
              ]
            }]}
            className="-striped -highlight"
          />

          <div style={{ textAlign: 'right', marginTop: '12px' }}>
            <a href='#' onClick={this.deleteAllMails}>Delete all</a>
          </div>
        </div>
      </>
    );
  }
}

export default Mails;
