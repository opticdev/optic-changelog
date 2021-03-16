import {getMetadata, setMetadata, isOpticComment} from '../src/pr'

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
