import React, { Component } from 'react';

export default class PopUp extends Component {

  constructor(props) {
    super(props);

    this.displayContent = props.currentEmail.displayContent.find(email => email.type === 'text/html').value;
    this.attachments = props.currentEmail.attachments || [];
  }

  handleClick = () => {
    this.props.hide();
  };

  showCidImageInMail = (attachment) => {
    this.displayContent = this.displayContent.replace(`cid:${attachment.content_id}`, `data:${attachment.type};base64, ${attachment.content}`);
  };

  render() {
    this.attachments
      .filter(attachment => attachment.disposition == 'inline')
      .forEach(attachment => this.showCidImageInMail(attachment))

    return (
      <div className="modal">
        <div className="modal_content">
          <span
            className="close"
            style={{ float: 'right', fontSize: '50px', marginRight: '20px' }}
            onClick={this.handleClick}
          >
            &times;
          </span>
          <div dangerouslySetInnerHTML={{ __html: this.displayContent }} />
        </div>
      </div>
    );
  }
}