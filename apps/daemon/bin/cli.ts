#!/usr/bin/env node

/**
 * Harbourmaster CLI - Docker management daemon CLI
 */
import { Command } from 'commander';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';
import { AuthService } from '../src/services/auth.js';
import { DockerService } from '../src/services/docker.js';
import { getConfigDir } from '../src/config/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name('harbourmasterd')
  .description('Harbourmaster Docker management daemon')
  .version('0.1.0');

// Main command (default) - Start the daemon
program
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-p, --port <port>', 'Port to bind to', '9190')
  .option('--i-understand-the-risks', 'Allow network binding (dangerous)')
  .action(async (options) => {
    console.log('🚢 Starting Harbourmaster daemon...');

    // Validate network binding
    if ((options.host === '0.0.0.0' || options.host === '::') && !options.iUnderstandTheRisks) {
      console.error('');
      console.error('⚠️  SECURITY WARNING: You are trying to bind to all network interfaces');
      console.error('   This exposes Docker control to the network, which is dangerous.');
      console.error('');
      console.error('   If you understand the risks and want to proceed:');
      console.error('   harbourmasterd --host 0.0.0.0 --i-understand-the-risks');
      console.error('');
      console.error('   Make sure you have:');
      console.error('   • Strong authentication configured');
      console.error('   • TLS/HTTPS enabled');
      console.error('   • Firewall rules in place');
      process.exit(1);
    }

    // Set environment variables
    process.env.HARBOURMASTER_HOST = options.host;
    process.env.HARBOURMASTER_PORT = options.port;
    if (options.iUnderstandTheRisks) {
      process.env.HARBOURMASTER_ALLOW_NETWORK = 'true';
    }

    // Start the main server
    const serverPath = join(__dirname, '..', 'src', 'index.js');
    try {
      await fs.access(serverPath);
    } catch {
      console.error('❌ Server not built. Run: npm run build');
      process.exit(1);
    }

    const child = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start daemon:', error.message);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      child.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
    });
  });

// Doctor command - Check system configuration
program
  .command('doctor')
  .description('Check system configuration and Docker connectivity')
  .action(async () => {
    console.log('🩺 Harbourmaster System Check');
    console.log('═'.repeat(50));

    let allGood = true;

    // Check 1: Docker socket connectivity
    console.log('Checking Docker connectivity...');
    try {
      const dockerService = DockerService.getInstance();
      await dockerService.connect();
      const healthy = await dockerService.healthCheck();

      if (healthy) {
        const socket = dockerService.getDetectedSocket();
        console.log(`✅ Docker connected: ${socket || 'default'}`);
      } else {
        console.log('❌ Docker ping failed');
        allGood = false;
      }
    } catch (error: any) {
      console.log(`❌ Docker connection failed: ${error.message}`);
      allGood = false;
    }

    // Check 2: Port availability
    console.log('Checking port 9190 availability...');
    try {
      const { createServer } = await import('net');
      const server = createServer();

      await new Promise<void>((resolve, reject) => {
        server.listen(9190, '127.0.0.1', () => {
          server.close();
          resolve();
        });
        server.on('error', reject);
      });

      console.log('✅ Port 9190 is available');
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.log('⚠️  Port 9190 is in use (daemon might be running)');
      } else {
        console.log(`❌ Port check failed: ${error.message}`);
        allGood = false;
      }
    }

    // Check 3: Config directory
    console.log('Checking configuration directory...');
    try {
      const configDir = getConfigDir();
      await fs.access(configDir);
      console.log(`✅ Config directory: ${configDir}`);
    } catch (error: any) {
      console.log(`❌ Config directory error: ${error.message}`);
      allGood = false;
    }

    // Check 4: Auth configuration
    console.log('Checking authentication setup...');
    try {
      const authService = AuthService.getInstance();
      await authService.initialize();
      console.log('✅ Authentication configured');
    } catch (error: any) {
      console.log(`❌ Auth setup failed: ${error.message}`);
      allGood = false;
    }

    console.log('═'.repeat(50));

    if (allGood) {
      console.log('🎉 All checks passed! System is ready.');
      console.log('');
      console.log('To start the daemon:');
      console.log('  harbourmasterd');
      console.log('');
      console.log('Then access the UI at:');
      console.log('  http://localhost:9190');
    } else {
      console.log('❌ Some checks failed. See troubleshooting below:');
      console.log('');
      console.log('Docker Issues:');
      console.log('  • Make sure Docker is running: docker info');
      console.log('  • Check Docker Desktop is started');
      console.log('  • For Linux: sudo systemctl status docker');
      console.log('');
      console.log('Port Issues:');
      console.log('  • Check if daemon is already running: ps aux | grep harbourmaster');
      console.log('  • Kill existing process: pkill -f harbourmaster');
      console.log('  • Use different port: harbourmasterd --port 9191');
      console.log('');
      console.log('Permission Issues:');
      console.log('  • Check file permissions in config directory');
      console.log('  • For Linux: add user to docker group');
      console.log('    sudo usermod -aG docker $USER');
      console.log('    newgrp docker');

      process.exit(1);
    }
  });

// Set admin password command
program
  .command('set-admin')
  .description('Set or update admin password')
  .option('-p, --password <password>', 'New password (will prompt if not provided)')
  .action(async (options) => {
    console.log('🔐 Setting admin password...');

    let password = options.password;

    if (!password) {
      // Prompt for password
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      password = await new Promise<string>((resolve) => {
        rl.question('Enter new admin password: ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });

      if (!password || password.trim().length === 0) {
        console.error('❌ Password cannot be empty');
        process.exit(1);
      }
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      process.exit(1);
    }

    try {
      const authService = AuthService.getInstance();
      await authService.setPassword(password);
      console.log('✅ Admin password updated successfully');
      console.log('');
      console.log('You can now log in to the UI with this password.');
    } catch (error: any) {
      console.error(`❌ Failed to set password: ${error.message}`);
      process.exit(1);
    }
  });

// Service install command
program
  .command('service:install')
  .description('Generate systemd/launchd service files')
  .action(async () => {
    console.log('🔧 Generating service files...');

    const currentPlatform = platform();
    const execPath = process.execPath; // Node.js executable
    const scriptPath = join(__dirname, 'cli.js');
    const user = process.env.USER || 'harbourmaster';

    if (currentPlatform === 'linux') {
      // Generate systemd service file
      const systemdService = `[Unit]
Description=Harbourmaster Docker Management Daemon
After=docker.service
Requires=docker.service
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=${user}
ExecStart=${execPath} ${scriptPath}
WorkingDirectory=${process.cwd()}
Environment=NODE_ENV=production
Environment=HARBOURMASTER_HOST=127.0.0.1
Environment=HARBOURMASTER_PORT=9190

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${getConfigDir()}

[Install]
WantedBy=multi-user.target
`;

      console.log('Linux systemd service file:');
      console.log('═'.repeat(50));
      console.log(systemdService);
      console.log('═'.repeat(50));
      console.log('');
      console.log('To install:');
      console.log('1. Save the above content to: /etc/systemd/system/harbourmasterd.service');
      console.log('2. sudo systemctl daemon-reload');
      console.log('3. sudo systemctl enable harbourmasterd');
      console.log('4. sudo systemctl start harbourmasterd');
      console.log('');
      console.log('To check status:');
      console.log('  sudo systemctl status harbourmasterd');
      console.log('  sudo journalctl -u harbourmasterd -f');

    } else if (currentPlatform === 'darwin') {
      // Generate launchd plist
      const launchdPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.harbourmaster.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
        <string>${scriptPath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${process.cwd()}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${homedir()}/Library/Logs/harbourmasterd.log</string>
    <key>StandardErrorPath</key>
    <string>${homedir()}/Library/Logs/harbourmasterd.error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>HARBOURMASTER_HOST</key>
        <string>127.0.0.1</string>
        <key>HARBOURMASTER_PORT</key>
        <string>9190</string>
    </dict>
</dict>
</plist>
`;

      console.log('macOS launchd plist file:');
      console.log('═'.repeat(50));
      console.log(launchdPlist);
      console.log('═'.repeat(50));
      console.log('');
      console.log('To install:');
      console.log('1. Save the above content to: ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
      console.log('2. launchctl load ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
      console.log('3. launchctl start com.harbourmaster.daemon');
      console.log('');
      console.log('To check status:');
      console.log('  launchctl list | grep harbourmaster');
      console.log('  tail -f ~/Library/Logs/harbourmasterd.log');

    } else {
      console.log(`❌ Unsupported platform: ${currentPlatform}`);
      console.log('Service files are only supported on Linux (systemd) and macOS (launchd)');
      process.exit(1);
    }
  });

// Service uninstall command
program
  .command('service:uninstall')
  .description('Show instructions for removing service files')
  .action(() => {
    console.log('🗑️  Service removal instructions');
    console.log('═'.repeat(50));

    const currentPlatform = platform();

    if (currentPlatform === 'linux') {
      console.log('Linux (systemd):');
      console.log('1. sudo systemctl stop harbourmasterd');
      console.log('2. sudo systemctl disable harbourmasterd');
      console.log('3. sudo rm /etc/systemd/system/harbourmasterd.service');
      console.log('4. sudo systemctl daemon-reload');
      console.log('');
      console.log('To also remove data:');
      console.log(`5. rm -rf ${getConfigDir()}`);

    } else if (currentPlatform === 'darwin') {
      console.log('macOS (launchd):');
      console.log('1. launchctl stop com.harbourmaster.daemon');
      console.log('2. launchctl unload ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
      console.log('3. rm ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
      console.log('');
      console.log('To also remove data:');
      console.log(`4. rm -rf ${getConfigDir()}`);
      console.log('5. rm ~/Library/Logs/harbourmasterd*.log');

    } else {
      console.log(`Platform: ${currentPlatform}`);
      console.log('Manual process cleanup required.');
      console.log('');
      console.log('To remove data:');
      console.log(`1. rm -rf ${getConfigDir()}`);
    }

    console.log('');
    console.log('⚠️  Warning: This will permanently delete all configuration data.');
  });

// Parse command line arguments
program.parse();