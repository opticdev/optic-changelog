import * as fs from 'fs'
import {generateCommentBody, getMetadata, setMetadata, isOpticComment} from '../src/pr'
import {generateEndpointChanges} from '@useoptic/changelog'

const bodyWithData = `Body text here

<!-- optic = {"name":"Jane Doe"} -->`

const updatedBody = `Body text here

<!-- optic = {"name":"Jane Doe","email":"jdoe@example.com"} -->`

describe('getMetadata', () => {
  it('pulls metadata from the body text', () => {
    const result = getMetadata(bodyWithData)
    expect(result).toEqual({
      name: 'Jane Doe'
    })
  })
})

describe('setMetadata', () => {
  it('adds metadata to a body', () => {
    const data = {
      name: 'Jane Doe'
    }
    const result = setMetadata('Body text here', data)
    expect(result).toEqual(bodyWithData)
  })

  it('updates metadata in a body', () => {
    expect(
      setMetadata(bodyWithData, {
        email: 'jdoe@example.com'
      })
    ).toEqual(updatedBody)
  })
})

describe('isOpticComment', () => {
  it('recognizes Optic comment', () => {
    expect(isOpticComment(bodyWithData)).toBeTruthy
  })

  it('skips comments that are not Optic comments', () => {
    expect(isOpticComment('No Optic metadata')).toBeFalsy
  })
})

const specs = [
  {
    name: "add new endpoint",
    file: "./__tests__/specs/add-new-endpoint.json",
    sinceCreatedAt: null,
    sinceBatchCommitId: null
  },
  {
    name: "add optional response field",
    file: "./__tests__/specs/add-optional-res-field.json",
    sinceCreatedAt: "2021-04-07T15:13:51.698Z",
    sinceBatchCommitId: "9c60b8fb-faec-43f3-a0fb-171306f98d61"
  },
  {
    name: "add required response field",
    file: "./__tests__/specs/add-required-res-field.json",
    sinceCreatedAt: "2021-04-07T15:11:49.282Z",
    sinceBatchCommitId: "6c785ae0-ac1a-4c36-9fc9-e15c587459f8"
  },
  {
    name: "add response status code",
    file: "./__tests__/specs/add-res-status-code.json",
    sinceCreatedAt: "2021-04-07T15:16:53.719Z",
    sinceBatchCommitId: "9ebee98a-77a0-4dfb-b240-966eb610274b"
  },
  {
    name: "update optional response field",
    file: "./__tests__/specs/update-optional-res-field.json",
    sinceCreatedAt: "2021-04-07T15:15:16.190Z",
    sinceBatchCommitId: "5fb6357e-fc7a-4fac-8f00-db1589061e85"
  },
  {
    name: "add endpoint to existing spec",
    file: "./__tests__/specs/add-endpoint-to-existing-spec.json",
    sinceCreatedAt: "2021-04-07T15:20:11.649Z",
    sinceBatchCommitId: "c03ccae6-f3c9-4d9c-a3b6-3d710dbdb4ec"
  },
  // Use an existing spec but pick last batch commit
  {
    name: "no changes",
    file: "./__tests__/specs/add-endpoint-to-existing-spec.json",
    sinceCreatedAt: "2021-04-07T15:52:15.419Z",
    sinceBatchCommitId: "42355178-d7d7-4510-a261-bf7f579d71a3"
  },
  {
    name: "complex changes",
    file: "./__tests__/specs/complex.json",
    sinceCreatedAt: "2021-04-07T15:52:15.419Z",
    sinceBatchCommitId: "42355178-d7d7-4510-a261-bf7f579d71a3"
  },
]

const specData = specs.map(spec => {
  const currentEvents = JSON.parse(fs.readFileSync(spec.file).toString('utf-8'))
  const initialEvents = JSON.parse(fs.readFileSync(`.${spec.file.split("\.")[1]}--initial.json`).toString('utf-8'))
  return { initialEvents, currentEvents, name: spec.name }
})

specData.forEach(({initialEvents, currentEvents, name}) => {
  describe(`Comment for spec ${name}`, () => {
    let dateSpy

    beforeAll(() => {
      dateSpy = jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => "2021-04-07T19:42:18.551Z")
    })

    afterAll(() => {
      dateSpy.mockRestore()
    })

    it("renders the changelog comment", async () => {
      const changes = await generateEndpointChanges(initialEvents, currentEvents)
      const results = generateCommentBody({
        data: changes.data.endpointChanges
      }, [])
      expect(results).toMatchSnapshot()
    })
  })
})