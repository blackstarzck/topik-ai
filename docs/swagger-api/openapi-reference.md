# OpenAPI Reference Index

[Back to Swagger API README](./README.md)

Source Swagger UI: https://api.dotoretopik.com/docs
Source OpenAPI JSON: https://api.dotoretopik.com/openapi.json
Generated: 2026-06-23

This file is intentionally short. The previous single-file reference was split so agents can open only the API group or schema group they need.

## Coverage Summary

|Item|Count|
|---|---|
|OpenAPI paths|74|
|Operations|79|
|Component schemas|123|
|Security schemes|2|

## Main Files

|File|Purpose|
|---|---|
|[README.md](./README.md)|Entry point and recommended reading order.|
|[auth-and-errors.md](./auth-and-errors.md)|Auth headers, practical header examples, response/error code index.|
|[writing-api-v13-screen-map.html](./writing-api-v13-screen-map.html)|v13 Writing screen integration map.|

## Endpoint Files

|Group|Endpoints|File|
|---|---|---|
|Admin Campaign API|24|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md)|
|Admin Evaluation API|12|[endpoints/admin-eval.md](./endpoints/admin-eval.md)|
|Admin Users API|6|[endpoints/admin-users.md](./endpoints/admin-users.md)|
|Eval Auth API|1|[endpoints/eval-auth.md](./endpoints/eval-auth.md)|
|Evaluation API|2|[endpoints/evaluation.md](./endpoints/evaluation.md)|
|External Campaign API|6|[endpoints/external-campaign.md](./endpoints/external-campaign.md)|
|Listening API|10|[endpoints/listening.md](./endpoints/listening.md)|
|Reading API|9|[endpoints/reading.md](./endpoints/reading.md)|
|Writing API|9|[endpoints/writing.md](./endpoints/writing.md)|

## Schema Files

|Group|Schemas|File|
|---|---|---|
|Common/shared|3|[schemas/common.md](./schemas/common.md)|
|Admin Campaign API|26|[schemas/admin-campaign.md](./schemas/admin-campaign.md)|
|Admin Evaluation API|18|[schemas/admin-eval.md](./schemas/admin-eval.md)|
|Admin Users API|5|[schemas/admin-users.md](./schemas/admin-users.md)|
|Eval Auth API|3|[schemas/eval-auth.md](./schemas/eval-auth.md)|
|Evaluation API|9|[schemas/evaluation.md](./schemas/evaluation.md)|
|External Campaign API|11|[schemas/external-campaign.md](./schemas/external-campaign.md)|
|Listening API|17|[schemas/listening.md](./schemas/listening.md)|
|Reading API|15|[schemas/reading.md](./schemas/reading.md)|
|Writing API|16|[schemas/writing.md](./schemas/writing.md)|

## Full Endpoint Index

|Method|Path|Group|File|
|---|---|---|---|
|`GET`|`/api/admin/campaign/contact-inquiries`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaigncontact-inquiries)|
|`GET`|`/api/admin/campaign/reviewers`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignreviewers)|
|`GET`|`/api/admin/campaign/stats/overview`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignstatsoverview)|
|`GET`|`/api/admin/campaign/submissions`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignsubmissions)|
|`DELETE`|`/api/admin/campaign/submissions/{submission_id}`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#delete-apiadmincampaignsubmissionssubmissionid)|
|`GET`|`/api/admin/campaign/submissions/{submission_id}`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignsubmissionssubmissionid)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/assign`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidassign)|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/attachments/{idx}`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignsubmissionssubmissionidattachmentsidx)|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/audit-log`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignsubmissionssubmissionidaudit-log)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/claim`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidclaim)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/content-edit`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidcontent-edit)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/email`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidemail)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/invalidate`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidinvalidate)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/pdf`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidpdf)|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/pdf/download`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignsubmissionssubmissionidpdfdownload)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/resend-email`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidresend-email)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/score`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidscore)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/source-edit`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidsource-edit)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/state`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidstate)|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/translation`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#post-apiadmincampaignsubmissionssubmissionidtranslation)|
|`GET`|`/api/admin/campaign/tasks/{task_id}/status`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaigntaskstaskidstatus)|
|`GET`|`/api/admin/campaign/users`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignusers)|
|`GET`|`/api/admin/campaign/users/{email}/submissions`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignusersemailsubmissions)|
|`GET`|`/api/admin/campaign/waitlist`|Admin Campaign API|[endpoints/admin-campaign.md](./endpoints/admin-campaign.md#get-apiadmincampaignwaitlist)|
|`GET`|`/api/admin/eval/datasets`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevaldatasets)|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/results`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevaldatasetsdatasetidresults)|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/stats`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevaldatasetsdatasetidstats)|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalreviewstargettypetargetid)|
|`POST`|`/api/admin/eval/reviews/{target_type}/{target_id}`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#post-apiadminevalreviewstargettypetargetid)|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}/my`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalreviewstargettypetargetidmy)|
|`POST`|`/api/admin/eval/run`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#post-apiadminevalrun)|
|`GET`|`/api/admin/eval/run/{run_id}/status`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalrunrunidstatus)|
|`GET`|`/api/admin/eval/stats/overview`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalstatsoverview)|
|`GET`|`/api/admin/eval/submissions/{submission_id}`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalsubmissionssubmissionid)|
|`GET`|`/api/admin/eval/users`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalusers)|
|`GET`|`/api/admin/eval/users/{user_id}/submissions`|Admin Evaluation API|[endpoints/admin-eval.md](./endpoints/admin-eval.md#get-apiadminevalusersuseridsubmissions)|
|`GET`|`/api/admin/users`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#get-apiadminusers)|
|`POST`|`/api/admin/users`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#post-apiadminusers)|
|`DELETE`|`/api/admin/users/{user_id}`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#delete-apiadminusersuserid)|
|`GET`|`/api/admin/users/{user_id}`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#get-apiadminusersuserid)|
|`PATCH`|`/api/admin/users/{user_id}`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#patch-apiadminusersuserid)|
|`POST`|`/api/admin/users/{user_id}/password`|Admin Users API|[endpoints/admin-users.md](./endpoints/admin-users.md#post-apiadminusersuseridpassword)|
|`POST`|`/api/eval/auth/login`|Eval Auth API|[endpoints/eval-auth.md](./endpoints/eval-auth.md#post-apievalauthlogin)|
|`GET`|`/api/evaluation/{submission_id}`|Evaluation API|[endpoints/evaluation.md](./endpoints/evaluation.md#get-apievaluationsubmissionid)|
|`GET`|`/api/evaluation/{submission_id}/feedback`|Evaluation API|[endpoints/evaluation.md](./endpoints/evaluation.md#get-apievaluationsubmissionidfeedback)|
|`POST`|`/api/external/campaign/contact`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#post-apiexternalcampaigncontact)|
|`POST`|`/api/external/campaign/follow-up`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#post-apiexternalcampaignfollow-up)|
|`POST`|`/api/external/campaign/submissions`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#post-apiexternalcampaignsubmissions)|
|`GET`|`/api/external/campaign/submissions/{submission_id}`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#get-apiexternalcampaignsubmissionssubmissionid)|
|`POST`|`/api/external/campaign/uploads`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#post-apiexternalcampaignuploads)|
|`POST`|`/api/external/campaign/waitlist`|External Campaign API|[endpoints/external-campaign.md](./endpoints/external-campaign.md#post-apiexternalcampaignwaitlist)|
|`GET`|`/api/listening/audio-bank/{filename}`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteningaudio-bankfilename)|
|`GET`|`/api/listening/audio/{session_id}/{filename}`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteningaudiosessionidfilename)|
|`POST`|`/api/listening/bookmark/{problem_id}`|Listening API|[endpoints/listening.md](./endpoints/listening.md#post-apilisteningbookmarkproblemid)|
|`GET`|`/api/listening/history`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteninghistory)|
|`GET`|`/api/listening/question-types`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteningquestion-types)|
|`POST`|`/api/listening/session`|Listening API|[endpoints/listening.md](./endpoints/listening.md#post-apilisteningsession)|
|`GET`|`/api/listening/session/{session_id}`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteningsessionsessionid)|
|`GET`|`/api/listening/session/{session_id}/results`|Listening API|[endpoints/listening.md](./endpoints/listening.md#get-apilisteningsessionsessionidresults)|
|`POST`|`/api/listening/session/{session_id}/submit`|Listening API|[endpoints/listening.md](./endpoints/listening.md#post-apilisteningsessionsessionidsubmit)|
|`POST`|`/api/listening/session/stream`|Listening API|[endpoints/listening.md](./endpoints/listening.md#post-apilisteningsessionstream)|
|`POST`|`/api/reading/bookmark/{problem_id}`|Reading API|[endpoints/reading.md](./endpoints/reading.md#post-apireadingbookmarkproblemid)|
|`POST`|`/api/reading/generate`|Reading API|[endpoints/reading.md](./endpoints/reading.md#post-apireadinggenerate)|
|`GET`|`/api/reading/history`|Reading API|[endpoints/reading.md](./endpoints/reading.md#get-apireadinghistory)|
|`GET`|`/api/reading/question-types`|Reading API|[endpoints/reading.md](./endpoints/reading.md#get-apireadingquestion-types)|
|`GET`|`/api/reading/session/{session_id}`|Reading API|[endpoints/reading.md](./endpoints/reading.md#get-apireadingsessionsessionid)|
|`GET`|`/api/reading/session/{session_id}/results`|Reading API|[endpoints/reading.md](./endpoints/reading.md#get-apireadingsessionsessionidresults)|
|`POST`|`/api/reading/session/{session_id}/submit`|Reading API|[endpoints/reading.md](./endpoints/reading.md#post-apireadingsessionsessionidsubmit)|
|`POST`|`/api/reading/session/stream`|Reading API|[endpoints/reading.md](./endpoints/reading.md#post-apireadingsessionstream)|
|`POST`|`/api/reading/submit`|Reading API|[endpoints/reading.md](./endpoints/reading.md#post-apireadingsubmit)|
|`POST`|`/api/writing/chat`|Writing API|[endpoints/writing.md](./endpoints/writing.md#post-apiwritingchat)|
|`GET`|`/api/writing/feedback/{submission_id}/export-pdf`|Writing API|[endpoints/writing.md](./endpoints/writing.md#get-apiwritingfeedbacksubmissionidexport-pdf)|
|`POST`|`/api/writing/generate`|Writing API|[endpoints/writing.md](./endpoints/writing.md#post-apiwritinggenerate)|
|`GET`|`/api/writing/history`|Writing API|[endpoints/writing.md](./endpoints/writing.md#get-apiwritinghistory)|
|`DELETE`|`/api/writing/history/{submission_id}`|Writing API|[endpoints/writing.md](./endpoints/writing.md#delete-apiwritinghistorysubmissionid)|
|`POST`|`/api/writing/save-draft`|Writing API|[endpoints/writing.md](./endpoints/writing.md#post-apiwritingsave-draft)|
|`POST`|`/api/writing/submit`|Writing API|[endpoints/writing.md](./endpoints/writing.md#post-apiwritingsubmit)|
|`GET`|`/api/writing/tasks`|Writing API|[endpoints/writing.md](./endpoints/writing.md#get-apiwritingtasks)|
|`GET`|`/api/writing/tasks/{task_type}`|Writing API|[endpoints/writing.md](./endpoints/writing.md#get-apiwritingtaskstasktype)|
