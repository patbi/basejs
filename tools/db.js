global.Promise = require('bluebird');
const bcrypt = require('bcrypt-nodejs');
const program = require('commander');
const schemas = require('../models/schemas');
const mongo = require('../lib/mongodb');

const { log } = console;

function connect() {
  return mongo.getReady.catch(() => {
    log('Exiting - Failed to connect to db');
    process.exit(1);
  });
}

function getCollection(db, name) {
  return new Promise((resolve, reject) => {
    db.collection(name, { strict: true }, (err, collection) => {
      if (err) reject(err);
      resolve(collection);
    });
  });
}

const commands = {
  async clean() {
    const { db } = await connect();
    log('Deleting DB...');
    return db.dropDatabase();
  },

  async init() {
    const { db } = await connect();
    log('Creating collections with their schema and indexes...');

    // Create collections and update latest schema
    return Promise.each(Object.keys(schemas), async (collectionName) => {
      log(` ${collectionName}`);
      await db.createCollection(collectionName);
      await db.command({ collMod: collectionName, validator: schemas[collectionName].schema });
      Promise.each(schemas[collectionName].indexes, async (index) => {
        await db.createIndex(collectionName, index.fields, index.options);
      });
    });
  },

  async users() {
    const { db } = await connect();
    log('Creating users...');

    const users = await getCollection(db, 'users');

    async function createUser(type) {
      log(` ${type}`);

      const isExist = await users.find({ email: type }, { limit: 1 }).count({ limit: true });
      if (!isExist) {
        await users.insertOne({
          username: type,
          email: `${type}@example.com`,
          password: bcrypt.hashSync(type),
          role: type,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        log('User already exists. Skipping');
      }
    }

    await createUser('admin');
    await createUser('moderator');
    await createUser('user');
  },

  async all() {
    await commands.clean();
    await commands.init();
    await commands.users();
  },
};

async function run(command) {
  try {
    await commands[command]();
  } catch (err) {
    log(`error: ${err.message}`);
    process.exit(1);
  }
}

function done() {
  log('Done!');
  process.exit();
}

// Command line options
program
  .command('clean')
  .description('delete all data and DB')
  .action(() => { run('clean').then(done); });

program
  .command('init')
  .description('create collections with their schema')
  .action(() => { run('init').then(done); });

program
  .command('users')
  .description('create sample users in different roles')
  .action(() => { run('users').then(done); });

program
  .command('all')
  .description('clean, init and create sample users')
  .action(() => { run('all').then(done); });

program
  .parse(process.argv);

// Display help whe no input
if (process.argv.length <= 2) program.help();
