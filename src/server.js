import Express from 'express';
import jwt from 'jsonwebtoken';
import debug from 'debug';
import { tokenGenerate } from '@vonage/jwt';
import { RCSCustom } from '@vonage/messages';
import { v4 as uuid } from 'uuid';
import { auth, vonage } from './vonage.js';

import { CronJob } from 'cron';

const log = debug('water:server');

const app = new Express();
const port = process.env.PORT || process.env.VCR_PORT || 3000;

const reminderNumber = '447904603505';

const reminders = [];

// Catch promises
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

app.use(Express.json());

app.post('/status', catchAsync(async (req, res) => {
  log('Status', req.body);
  res.status(200).json({ok: true});
}));

app.post('/inbound', catchAsync(async (req, res) => {
  log('Inbound', req.body);

  const {channel, message_type, reply, from} = req.body;
  if (channel !== 'rcs') {
    console.log('Not RCS');
    res.status(200).json({ok: true});
    return;
  }

  if (message_type !== 'reply') {
    console.log('Not reply');
    res.status(200).json({ok: true});
    return;
  }

  const { id } = reply|| {};

  console.log('Id', id);

  if (!id) {
    console.log('No id');
    res.status(200).json({ok: true});
    return;
  }

  if (!validateToken(id)) {
    console.log('Invalid id');
    res.status(200).json({ok: true});
    return;
  }

  const index = reminders.findIndex((reminder) => reminder.number === from);
  reminders.splice(index, 1);
  console.log('Reminder removed', reminders);

  res.status(200).json({ok: true});
}));

// Setup a 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 404,
    title: 'Not Found',
  });
});

// Setup an error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    status: 500,
    title: 'Internal Server Error',
    detail: err.message,
  });
});

// Start Express
app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});


const validateToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      auth.privateKey,
      {
        algorithms: ['RS256'],
        ignoreExpiration: true,
        ignoreNotBefore: true,
      },
    );

    const now = parseInt(Date.now());
    const expiry = new Date(decoded.exp * 1000).getTime();

    if (now > expiry) {
      console.log('Token expired');
      return false;
    }

    console.log('Token valid');
    return true;
  } catch (error) {
    console.error('Error decoding token', error);
    return false;
  }
};

const checkForReminders = (number) => {
  const search = reminders.find((reminder) => reminder.number === number);
  if (!search) {
    console.log('No reminder found');
    return false;
  }

  const { token } = search;
  console.log('Checking token', token);
  return validateToken(token);
};

//const job = new CronJob(
//  '1 * * * * *',
//  () => {
//    sendReminder(reminderNumber);
//  },
//  null,
//  true,
//  process.env.TZ || 'America/New_York',
//);

//const sendReminder = (number) => {
//  console.log('Checking for reminders');
//
//  if (checkForReminders(number)) {
//    console.log('Reminder already sent');
//    return;
//  }
//
//  sendMessage(number, (job.nextDate() / 1000) + 10000);
//};

const sendMessage = (number, exp) => {
  console.log('Sending message to', number);
  const token = tokenGenerate(
    auth.applicationId,
    auth.privateKey,
    {
      reminderId: uuid(),
      ...(exp ? {exp: exp} : {}),
    },
  );

  const message = new RCSCustom({
    to: number,
    from: 'VonageRCSDemo-DevRel',
    custom: {
      contentMessage: {
        richCard: {
          standaloneCard: {
            cardOrientation: 'VERTICAL',
            cardContent: {
              title: 'Drink Water Reminder',
              description: 'Did you drink water today?',
              media: {
                height: 'SHORT',
                contentInfo: {
                  fileUrl: 'https://as1.ftcdn.net/jpg/02/22/48/50/220_F_222485075_uAeqmITGagEGdy9D4nWVou0a6dj6EuUz.jpg',
                },
              },
              suggestions: [
                {
                  reply: {
                    text: 'Yes',
                    postbackData: token,
                  },
                },
              ],
            },
          },
        },
      },
    },
  });

  console.log('Sending reminder', message);
  vonage.messages.send(message)
    .then((res) => {
      console.log('Message sent', res);
    })
    .catch((err) => {
      console.error('Error sending message');
      err.response.text().then((text) => {
        console.log(text);
      },
      );
    });
};

sendMessage(reminderNumber);
//sendReminder(reminderNumber);
