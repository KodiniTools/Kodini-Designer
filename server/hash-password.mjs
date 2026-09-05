#!/usr/bin/env node
// Erzeugt einen scrypt-Passwort-Hash für ADMIN_PASSWORD_HASH.
//
//   node server/admin/hash-password.mjs 'MEIN-PASSWORT'
//   node server/admin/hash-password.mjs        # fragt interaktiv (versteckt)
//
// Ausgabe in /opt/kodini/.env eintragen:
//   ADMIN_PASSWORD_HASH=scrypt$....$....

import { hashPassword } from './auth.mjs';
import { createInterface } from 'node:readline';

async function fromStdin() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Eingabe verbergen
  const orig = rl._writeToOutput?.bind(rl);
  rl._writeToOutput = () => {};
  return new Promise((res) => {
    process.stdout.write('Passwort: ');
    rl.question('', (answer) => {
      rl._writeToOutput = orig;
      process.stdout.write('\n');
      rl.close();
      res(answer);
    });
  });
}

const pw = process.argv[2] || (await fromStdin());
if (!pw || pw.length < 8) {
  console.error('Passwort muss mindestens 8 Zeichen haben.');
  process.exit(1);
}
console.log(await hashPassword(pw));
