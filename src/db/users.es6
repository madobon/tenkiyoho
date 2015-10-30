import config from 'config';

let records = config.users;

let Users = () => {};

Users.prototype.findByUsername = (username, done) => {
  process.nextTick(() => {
    for (let record of records) {
      if (record.username === username) {
        return done(null, record);
      }
    }
    return done(null, null);
  });
}

module.exports.users = new Users();
