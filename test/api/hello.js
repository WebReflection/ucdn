module.exports = (req, res) => {
  res.writeHead(200, {'content-type': 'text/html;charset=utf-8'});
  res.end('<h1>Hello API!</h1>');
};
