#!/bin/bash
gcloud iam service-accounts add-iam-policy-binding github-actions@project-0708fb26-e204-4400-ae9.iam.gserviceaccount.com --project=project-0708fb26-e204-4400-ae9 --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/276371417285/locations/global/workloadIdentityPools/github-pool/attribute.repository/vrajaramesh/mybill-ui"
echo "Done!"
