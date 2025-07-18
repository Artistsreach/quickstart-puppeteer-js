import { exec } from 'child_process';

exec('pkill -9 node', (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
});
