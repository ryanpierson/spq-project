# API Reference

### Get a candidate by candidate id
Get a candidate's email, name, and quiz submissions by candidate id:

`GET /candidate/:candidateId`

The response is JSON with email, name, and json encoded quiz results:
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

The response is a json array of candidate ids:
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

The response is a json array of candidate ids keyed by the candidate's email:
```
{
    "test1@test.com": "5670392840585216",
    "test2@test.com": "5748214695198720",
    "test3@test.com": "5672878150254592"
}
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
