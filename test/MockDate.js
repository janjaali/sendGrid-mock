const withMockedDate = (date, fn) => {

  const RealDate = Date;

  global.Date = jest.fn().mockImplementation(() => date);
  global.Date.now = jest.fn().mockReturnValue(date.valueOf());
  global.Date.parse = RealDate.parse;
  
  fn();

  global.Date = RealDate;    
};

module.exports = {
  withMockedDate,
};
