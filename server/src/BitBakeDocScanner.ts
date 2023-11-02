/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { logger } from 'vscode-bitbake-lib'
import { CompletionItemKind, type CompletionItem } from 'vscode-languageserver'

type SuffixType = 'layer' | 'providedItem' | undefined

export interface VariableInfos {
  name: string
  definition: string
  validFiles?: RegExp[] // Files on which the variable is defined. If undefined, the variable is defined in all files.
  suffixType?: SuffixType
}

type VariableInfosOverride = Partial<VariableInfos>

// Infos that can't be parsed properly from the doc
const variableInfosOverrides: Record<string, VariableInfosOverride> = {
  BBFILE_PATTERN: {
    suffixType: 'layer'
  },
  LAYERDEPENDS: {
    suffixType: 'layer'
  },
  LAYERDIR: {
    validFiles: [/^.*\/conf\/layer.conf$/]
  },
  LAYERDIR_RE: {
    validFiles: [/^.*\/conf\/layer.conf$/]
  },
  LAYERVERSION: {
    suffixType: 'layer'
  },
  PREFERRED_PROVIDER: {
    suffixType: 'providedItem'
  }
}

const variablesFilePath = 'doc/bitbake-user-manual/bitbake-user-manual-ref-variables.rst'
const variablesRegexForDoc = /^ {3}:term:`(?<name>[A-Z_]*?)`\n(?<definition>.*?)(?=^ {3}:term:|$(?!\n))/gsm

const yoctoTaskFilePath = path.join(__dirname, '../src/yocto-docs/tasks.rst')
const yoctoTaskPattern = /(?<=``)((?<name>do_.*)``\n-*\n\n(?<description>(.*\n)*?))\n(?=(\.\. _ref)|((.*)\n(=+)))/g

export class BitBakeDocScanner {
  private _variablesInfos: Record<string, VariableInfos> = {}
  private _yoctoTaskCompletionItems: CompletionItem[] = []
  private _variableFlagCompletionItems: CompletionItem[] = []
  private _variableCompletionItems: CompletionItem[] = []

  get variablesInfos (): Record<string, VariableInfos> {
    return this._variablesInfos
  }

  get yoctoTaskCompletionItems (): CompletionItem[] {
    return this._yoctoTaskCompletionItems
  }

  get variableFlagCompletionItems (): CompletionItem[] {
    return this._variableFlagCompletionItems
  }

  get variableCompletionItems (): CompletionItem[] {
    return this._variableCompletionItems
  }

  parseVariablesFile (pathToBitbakeFolder: string): void {
    let file = ''
    const docPath = path.join(pathToBitbakeFolder, variablesFilePath)
    try {
      file = fs.readFileSync(docPath, 'utf8')
    } catch {
      logger.warn(`BitBake doc file not found at ${docPath}`)
    }
    const variableCompletionItems: CompletionItem[] = []
    for (const match of file.matchAll(variablesRegexForDoc)) {
      const name = match.groups?.name
      // Naive silly inneficient incomplete conversion to markdown
      const definition = match.groups?.definition
        .replace(/^ {3}/gm, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important|tip)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
        .replace(/^\n(\s{5,})/gm, ' ')
        .replace(/^(\s{5,})/gm, ' ')
      if (name === undefined || definition === undefined) {
        return
      }
      this._variablesInfos[name] = {
        name,
        definition,
        ...variableInfosOverrides[name]
      }

      variableCompletionItems.push({
        label: name,
        documentation: definition,
        data: {
          referenceUrl: `https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-ref-variables.html#term-${name}`
        }
      })
    }
    this._variableCompletionItems = variableCompletionItems
  }

  public parseYoctoTaskFile (): void {
    let file = ''
    try {
      file = fs.readFileSync(yoctoTaskFilePath, 'utf8')
    } catch {
      logger.warn(`Failed to read Yocto task file at ${yoctoTaskFilePath}`)
    }

    const tasks: CompletionItem[] = []
    for (const yoctoTaskMatch of file.matchAll(yoctoTaskPattern)) {
      const taskName = yoctoTaskMatch.groups?.name
      const taskDescription = yoctoTaskMatch.groups?.description
        .replace(/\\n(?=")/g, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
        .replace(/`\$\{`[\\]+\s(.*)[\\]+\s`\}`/g, (_match, p1) => p1)
        .replace(/^\n(\s{5,})/gm, '\n\t') // when 5 or more spaces are present as indentation, the texts following are likely code. Replace the indentation with one tab to trigger highlighting in this documentation

      if (taskName !== undefined) {
        tasks.push({
          label: taskName,
          documentation: taskDescription,
          insertText: [
            `${taskName}(){`,
            /* eslint-disable no-template-curly-in-string */
            '\t${1:# Your code here}',
            '}'
          ].join('\n'),
          data: {
            referenceUrl: `https://docs.yoctoproject.org/singleindex.html#${taskName.replace(/_/g, '-')}`
          }
        })
      }
    }

    this._yoctoTaskCompletionItems = tasks
  }

  public parseVariableFlagFile (pathToBitbakeFolder: string): void {
    const variableFlagFilePath = 'doc/bitbake-user-manual/bitbake-user-manual-metadata.rst'
    const variableFlagSectionRegex = /(?<=Variable Flags\n=*\n\n)(?<variable_flag_section>.*\n)*(?<event_section_title>Events\n=*)/g
    const variableFlagRegex = /(?<=-\s*``\[)(?<name>.*)(?:\]``:)(?<description>(.*\n)*?)(?=\n-\s*``|\nEvents)/g

    const completeVariableFlagFilePath = path.join(pathToBitbakeFolder, variableFlagFilePath)
    let file = ''
    try {
      file = fs.readFileSync(completeVariableFlagFilePath, 'utf8')
    } catch {
      logger.error(`Failed to read file at ${completeVariableFlagFilePath}`)
    }

    const variableFlagSection = file.match(variableFlagSectionRegex)
    if (variableFlagSection === null) {
      logger.warn(`No variable flag section found at ${completeVariableFlagFilePath}. Is the regex correct?`)
      return
    }

    const variableFlags: CompletionItem[] = []
    for (const match of variableFlagSection[0].matchAll(variableFlagRegex)) {
      const name = match.groups?.name
      const description = match.groups?.description
        .replace(/:term:|:ref:/g, '')
        .replace(/::/g, ':')
        .replace(/``\[/g, '`')
        .replace(/\]``/g, '`')
        .replace(/\.\.\s/g, '')
        .replace(/-\s\s/g, '')
        .replace(/^\n(\s{2,})/gm, '')
      if (name === undefined || description === undefined) {
        return
      }

      if (name !== undefined) {
        variableFlags.push({
          label: name,
          documentation: description,
          kind: CompletionItemKind.Keyword,
          data: {
            referenceUrl: 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#variable-flags'
          }
        })
      }
    }

    this._variableFlagCompletionItems = variableFlags
  }
}

export const bitBakeDocScanner = new BitBakeDocScanner()
