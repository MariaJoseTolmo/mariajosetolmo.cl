import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/app-config';
import { GetCvLink } from './application/get-cv-link.use-case';
import { CV_LINK_SIGNER } from './application/ports/cv-link-signer.port';
import { createCvLinkSigner } from './infrastructure/cv-link-signer.factory';
import { CvController } from './infrastructure/http/cv.controller';

@Module({
  controllers: [CvController],
  providers: [
    GetCvLink,
    {
      provide: CV_LINK_SIGNER,
      useFactory: createCvLinkSigner,
      inject: [APP_CONFIG],
    },
  ],
})
export class CvModule {}
