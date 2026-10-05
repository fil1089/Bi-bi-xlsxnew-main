#!/usr/bin/env python3
"""
Deploy Bi-bi XLSX Lite на Спринтхост-поддомен xlsx-bibi.aibrainpulse.ru.

Схема как у Api migr: SFTP (paramiko), без git.
- Фронт: локальный dist/ -> public_html/ поддомена
- Бэк: app.js + server.mjs + api/*.mjs + package.server.json(как package.json)
- .env на сервере собирается из локального .env.local (секреты не коммитятся)
- Рестарт: touch tmp/restart.txt

Пароль SSH: env BIBI_SSH_PASS или ввод руками (не хранится в репозитории).

Usage:
    python deploy_bibi.py                 # build + full deploy
    python deploy_bibi.py --frontend      # только фронт (dist -> public_html)
    python deploy_bibi.py --backend       # только бэк (app.js/server.mjs/api)
    python deploy_bibi.py --no-build      # без сборки
    python deploy_bibi.py --dry-run       # показать что уедет, без заливки
    python deploy_bibi.py --health-check  # только ping /api/health
"""

import argparse
import getpass
import os
import subprocess
import sys
import time
from pathlib import Path

HOST = 'aibrainpulse.ru'
SSH_USER = 'a1246954'
BASE_DIR = Path(__file__).resolve().parent
REMOTE_APP = '/home/a1246954/domains/aibrainpulse.ru/public_html/xlsx-bibi'
REMOTE_PUBLIC_HTML = f'{REMOTE_APP}/public_html'
REMOTE_API = f'{REMOTE_APP}/api'
REMOTE_TMP = f'{REMOTE_APP}/tmp'
SITE_URL = 'https://xlsx-bibi.aibrainpulse.ru'

BACKEND_FILES = [
    'passenger.js',
    'server.mjs',
]

BACKEND_API_FILES = [
    'api/_db.mjs',
    'api/_auth.mjs',
    'api/auth/signup.mjs',
    'api/auth/login.mjs',
    'api/auth/me.mjs',
    'api/files/index.mjs',
    'api/files/delete.mjs',
]


def get_ssh_pass():
    pw = os.environ.get('BIBI_SSH_PASS')
    if pw:
        return pw
    return getpass.getpass(f'SSH password for {SSH_USER}@{HOST}: ')


def make_client(password):
    try:
        import paramiko
    except ImportError:
        print('ERROR: paramiko is required. Install: pip install paramiko')
        sys.exit(1)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=22, username=SSH_USER, password=password,
              timeout=60, banner_timeout=60, auth_timeout=60)
    c.get_transport().set_keepalive(15)
    return c


def mkdir_p(sftp, path):
    parts = path.strip('/').split('/')
    current = ''
    for p in parts:
        current += '/' + p
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def exec_cmd(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', 'replace')
    err = stderr.read().decode('utf-8', 'replace')
    code = stdout.channel.recv_exit_status()
    return code, out, err


def build_frontend():
    print('== npm run build ==')
    r = subprocess.run(['npm', 'run', 'build'], cwd=str(BASE_DIR), shell=True)
    if r.returncode != 0:
        print('BUILD FAILED')
        sys.exit(1)
    dist = BASE_DIR / 'dist'
    if not (dist / 'index.html').exists():
        print('ERROR: dist/index.html missing after build')
        sys.exit(1)
    print('build ok')


def read_local_env():
    """DATABASE_URL/JWT_SECRET из локального .env.local (gitignored)."""
    env_file = BASE_DIR / '.env.local'
    vals = {}
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            vals[k.strip()] = v.strip()
    for key in ('DATABASE_URL', 'JWT_SECRET'):
        if not vals.get(key):
            print(f'ERROR: {key} нет в .env.local')
            sys.exit(1)
    return vals


def upload_file(sftp, local: Path, remote: str, dry_run=False):
    parent = '/'.join(remote.split('/')[:-1])
    try:
        sftp.stat(parent)
    except FileNotFoundError:
        mkdir_p(sftp, parent)
    if dry_run:
        print(f'  [dry] {local} -> {remote}')
        return
    sftp.put(str(local), remote)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frontend', action='store_true')
    ap.add_argument('--backend', action='store_true')
    ap.add_argument('--no-build', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--health-check', action='store_true')
    args = ap.parse_args()

    do_front = args.frontend or not args.backend
    do_back = args.backend or not args.frontend
    if args.health_check:
        do_front = do_back = False

    if do_front and not args.no_build and not args.dry_run:
        build_frontend()

    password = get_ssh_pass()
    client = make_client(password)
    sftp = client.open_sftp()

    if do_back:
        print('== backend ==')
        for name in BACKEND_FILES:
            lp = BASE_DIR / name
            upload_file(sftp, lp, f'{REMOTE_APP}/{name}', args.dry_run)
            print(f'  {name}')
        # package.server.json -> package.json
        upload_file(sftp, BASE_DIR / 'package.server.json',
                    f'{REMOTE_APP}/package.json', args.dry_run)
        print('  package.server.json -> package.json')
        for name in BACKEND_API_FILES:
            lp = BASE_DIR / name
            if not lp.exists():
                print(f'  MISSING: {name}')
                sys.exit(1)
            upload_file(sftp, lp, f'{REMOTE_APP}/{name}', args.dry_run)
            print(f'  {name}')
        # .htaccess.subdomain -> .htaccess
        upload_file(sftp, BASE_DIR / '.htaccess.subdomain',
                    f'{REMOTE_APP}/.htaccess', args.dry_run)
        print('  .htaccess.subdomain -> .htaccess')
        # .env из локального .env.local
        vals = read_local_env()
        env_text = (
            f"DATABASE_URL={vals['DATABASE_URL']}\n"
            f"JWT_SECRET={vals['JWT_SECRET']}\n"
            f"ALLOWED_ORIGIN={SITE_URL}\n"
            f"PORT=3001\n"
        )
        if args.dry_run:
            print('  [dry] .env (DATABASE_URL/JWT_SECRET скрыты)')
        else:
            mkdir_p(sftp, REMOTE_APP)
            with sftp.open(f'{REMOTE_APP}/.env', 'w') as f:
                f.write(env_text)
            print('  .env written')

    if do_front:
        print('== frontend (dist -> public_html) ==')
        dist = BASE_DIR / 'dist'
        count = 0
        for root, dirs, files in os.walk(dist):
            dirs[:] = [d for d in dirs if d != '.git']
            for fn in files:
                lp = Path(root) / fn
                rel = lp.relative_to(dist).as_posix()
                upload_file(sftp, lp, f'{REMOTE_PUBLIC_HTML}/{rel}', args.dry_run)
                count += 1
        print(f'  files: {count}')

    if not args.dry_run:
        print('== npm install (server) ==')
        code, out, err = exec_cmd(
            client,
            f'export PATH=/opt/rh/rh-nodejs22/root/usr/bin:$PATH && cd {REMOTE_APP} && npm install --production 2>&1 | tail -5',
            timeout=300,
        )
        print(out[-2000:] if len(out) > 2000 else out)
        print('== restart passenger ==')
        code, out, err = exec_cmd(
            client,
            f'mkdir -p {REMOTE_TMP} && touch {REMOTE_TMP}/restart.txt && echo RESTARTED',
        )
        print(out.strip() or err.strip())
        print('waiting 15s for passenger...')
        time.sleep(15)
        print('== health check ==')
        code, out, err = exec_cmd(
            client,
            f'curl -sk -m 25 {SITE_URL}/api/health; echo',
        )
        print(out.strip() or err.strip())

    try:
        sftp.close()
    except Exception:
        pass
    client.close()
    print('DONE')


if __name__ == '__main__':
    main()
