/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { onCompletionHandler } from '../connectionHandlers/onCompletion'
import { analyzer } from '../tree-sitter/analyzer'
import { FIXTURE_DOCUMENT } from './fixtures/fixtures'
import { generateParser } from '../tree-sitter/parser'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import bitBakeProjectScanner from '../BitBakeProjectScanner'

const DUMMY_URI = 'dummy_uri'

/**
 * The onCompletion handler doesn't allow other parameters, so we can't pass the analyzer and therefore the same
 * instance used in the handler is used here. Documents are reset before each test for a clean state.
 * A possible alternative is making the entire server a class and the analyzer a member
 */
describe('On Completion', () => {
  beforeAll(async () => {
    if (!analyzer.hasParser()) {
      const parser = await generateParser()
      analyzer.initialize(parser)
    }
    analyzer.resetAnalyzedDocuments()
  })

  beforeEach(() => {
    analyzer.resetAnalyzedDocuments()
  })

  it('expects reserved variables, keywords and snippets in completion item lists', async () => {
    bitBakeDocScanner.parseYoctoTaskFile()

    // nothing is analyzed yet, only the static completion items are provided
    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 0,
        character: 1
      }
    })

    expect('length' in result).toBe(true)

    expect(result).toEqual(
      expect.arrayContaining([
        {
          kind: 14,
          label: 'python'
        }
      ])
    )

    expect(result).toEqual(
      expect.arrayContaining([
        {
          kind: 6,
          label: 'DESCRIPTION'
        }
      ])
    )

    expect(result).toEqual(
      /* eslint-disable no-template-curly-in-string */
      expect.arrayContaining([
        {
          documentation: {
            value: '```man\ndo_build (bitbake-language-server)\n\n\n```\n```bitbake\ndo_build(){\n\t# Your code here\n}\n```\n---\nThe default task for all recipes. This task depends on all other normal\ntasks required to build a recipe.\n\n[Reference](https://docs.yoctoproject.org/singleindex.html#do-build)',
            kind: 'markdown'
          },
          insertText: 'do_build(){\n\t${1:# Your code here}\n}',
          insertTextFormat: 2,
          label: 'do_build',
          kind: 15
        }
      ])
    )
  })

  it("doesn't provide suggestions when it is pure string content", async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 10
      }
    })

    expect(result).toEqual([])
  })

  it('provides suggestions when it is in variable expansion', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 1,
        character: 13
      }
    })

    expect(result).not.toEqual([])
  })

  it('provides suggestions for operators when a ":" is typed and it follows an identifier', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 6
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: 'append',
          kind: 24
        }
      ])
    )
  })

  it('provides suggestions for overrides when a ":" is typed and it follows an identifier', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const spy = jest.spyOn(bitBakeProjectScanner, 'overrides', 'get').mockReturnValue(['class-target'])

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 2,
        character: 6
      }
    })

    spy.mockRestore()

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            label: 'class-target',
            kind: 10
          }
        )
      ])
    )
  })

  it('provides no suggestions when a ":" is typed but it doesn\'t follow an identifier', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 13,
        character: 1
      }
    })

    expect(result).toEqual([])
  })

  it('provides fallback suggestions for variable flags when a "[" is typed and it follows an identifier', async () => {
    // TODO: This one only tests the fallback suggestions, the ones from docs require scanning docs in bitbake folder
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 3,
        character: 6
      }
    })

    expect(result).toEqual(
      expect.arrayContaining([
        {
          label: 'cleandirs',
          kind: 14
        }
      ])
    )
  })

  it('provides no suggestions when a "[" is typed but it doesn\'t follow a bitbake identifier', async () => {
    await analyzer.analyze({
      uri: DUMMY_URI,
      document: FIXTURE_DOCUMENT.COMPLETION
    })

    const result1 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 12,
        character: 1
      }
    })

    const result2 = onCompletionHandler({
      textDocument: {
        uri: DUMMY_URI
      },
      position: {
        line: 6,
        character: 10
      }
    })

    expect(result1).toEqual([])
    expect(result2).toEqual([])
  })
})
