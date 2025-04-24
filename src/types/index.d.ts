export type UserState = {
  step: 'askEmail' | 'waitForAttachment';
  email?: string;
};
