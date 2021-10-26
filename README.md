# API Reference

### Get a candidate
Get a candidate's email, name, and quiz submissions by candidate id:

`GET /candidate/:candidateId`

Response:
```json
{
    "email": "testemail@test.com",
    "name": "",
    "quizzes": ""
}
```

### Get a candidate by candidate id
Get a candidate's email, name, and quiz submissions by candidate id:

`GET /candidate/:candidateId`

Response:
```json
{
    "email": "testemail@test.com",
    "name": "Test Name",
    "quizzes": "json string including submitted quizzes - structure likely to change"
}
```

### Get candidate ids by employer id
Get a list of candidate ids for candidates who have been sent a quiz by the employer specified by the employer id:

`GET /employercandidates/:employerId`

Response:
```json
[
    "5151130757627904",
    "5085025104035840",
    "5699409840963584"
]
```

### Associate candidates with an employer
Associate candidates with an employer. This endpoint will create any candidates specified in the post body whose email
address is not already in the datastore. It then adds the id of the candidate to that employer's candidates list.

`POST /employercandidates/:employerId`

The post body should be a raw json array of email addresses for each candidate:
```json
["test1@test.com","test2@test.com","test3@test.com"]
```

### Get quiz html
This is currently using the mock endpoints below.
Valid employer id = 1
Valid quiz id = 1
`GET /employer/:employerId/quiz/:quizId`

### Mock endpoints for testing and debugging purposes
These endpoints will be replaced by [Bryan's API](https://github.com/brynsroberts/quiz_generation_backend/tree/main/documentation)

`GET /employer/:employerId`
`GET /quiz/:quizId`
`GET /question/:questionId`
