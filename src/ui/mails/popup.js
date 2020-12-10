import React, { Component } from "react";

export default class PopUp extends Component {
  handleClick = () => {
    this.props.hide();
  };

  render() {
    const currentEmail = this.props.currentEmail;
  
    return (
      <div className="modal">
        <div className="modal_content">
          <span className="close" style={{float: 'right', fontSize: '50px', marginRight: '20px'}} onClick={this.handleClick}>&times;    </span>
          <div dangerouslySetInnerHTML={{__html: currentEmail}} />
        </div>
      </div>
    );
  }
}