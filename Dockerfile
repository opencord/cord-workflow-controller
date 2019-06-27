# opencord/cord-workflow-control-service
# To build use: docker build -t opencord/cord-workflow-control-service .
# To run use: docker run -p 3000:3000 -d opencord/cord-workflow-control-service

FROM node:10.16-alpine

# Set environment variables
ENV CODE_SOURCE .
ENV CODE_DEST /var/www

# Create app directory
WORKDIR ${CODE_DEST}

# install librdkafka
RUN apk --no-cache add -U python make bash g++

# Copy over app dependencies and source files
COPY ${CODE_SOURCE}/package.json ${CODE_DEST}/
COPY ${CODE_SOURCE}/src/ ${CODE_DEST}/src/

# Install app dependencies and create logdir
RUN npm install --production \
 && mkdir ${CODE_DEST}/logs

EXPOSE 3000

# Label image
ARG org_label_schema_schema_version=1.0
ARG org_label_schema_name=cord-workflow-controller
ARG org_label_schema_version=unknown
ARG org_label_schema_vcs_url=unknown
ARG org_label_schema_vcs_ref=unknown
ARG org_label_schema_build_date=unknown
ARG org_opencord_vcs_commit_date=unknown

LABEL org.label-schema.schema-version=$org_label_schema_schema_version \
      org.label-schema.name=$org_label_schema_name \
      org.label-schema.version=$org_label_schema_version \
      org.label-schema.vcs-url=$org_label_schema_vcs_url \
      org.label-schema.vcs-ref=$org_label_schema_vcs_ref \
      org.label-schema.build-date=$org_label_schema_build_date \
      org.opencord.vcs-commit-date=$org_opencord_vcs_commit_date

CMD [ "npm", "start" ]