/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'

import { logger } from '../ui/OutputLogger'
import { type BitbakeSettings, loadBitbakeSettings } from './BitbakeSettings'

/// This class is responsible for wrapping up all bitbake classes and exposing them to the extension
export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = { pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '' }

  loadSettings (): void {
    this.bitbakeSettings = loadBitbakeSettings()
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }

  /// Execute a command in the bitbake environment
  spawnBitbakeProcess (command: string): childProcess.ChildProcess {
    const shell = process.env.SHELL ?? '/bin/sh'

    command = this.composeBitbakeScript(command)
    logger.debug(`Executing Bitbake command: ${shell} -c ${command}\nSee output in terminal view`)
    return childProcess.spawn(command, {
      shell
    })
  }

  private composeBitbakeScript (command: string): string {
    let script = ''
    command = sanitizeForShell(command)

    script += 'set -e && '
    script += `. ${sanitizeForShell(this.bitbakeSettings.pathToEnvScript)} ${sanitizeForShell(this.bitbakeSettings.pathToBuildFolder)} && `
    script += command

    script = `echo 'Executing script: ${script}' && ${script}`
    return script
  }
}

/// Santitize a string to be passed in a shell command (remove special characters)
export function sanitizeForShell (command: string): string {
  return command.replace(/[;`&|<>\\$(){}!#*?"']/g, '')
}
