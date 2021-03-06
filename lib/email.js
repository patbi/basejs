const nodemailer = require('nodemailer');
const app = require('../app');
const options = require('./options')('email');

// Create transporter
const transporter = nodemailer.createTransport({ service: options.service }, options);

// Promisify
const render = Promise.promisify(app.render, { context: app });
const sendMail = Promise.promisify(transporter.sendMail, { context: transporter });

// Send email
function send(settings = {}, data = {}) {
  // Default template
  const mail = Object.assign({}, settings);
  mail.template = mail.template || options.template;

  // Render template into html
  return render(`emails/${mail.template}`, data).then((html) => {
    mail.html = html;

    // Send email
    return sendMail(mail);
  });
}

module.exports = { send };
