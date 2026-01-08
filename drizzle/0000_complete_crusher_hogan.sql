CREATE TABLE `email_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`provider` text NOT NULL,
	`imap_host` text NOT NULL,
	`imap_port` integer NOT NULL,
	`imap_user` text NOT NULL,
	`imap_password` text NOT NULL,
	`is_active` integer DEFAULT 1,
	`is_default` integer DEFAULT 0,
	`created_at` integer DEFAULT '"2026-01-08T02:23:53.382Z"',
	`updated_at` integer DEFAULT '"2026-01-08T02:23:53.382Z"',
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_accounts_email_unique` ON `email_accounts` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_accounts_email_idx` ON `email_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `email_accounts_active_idx` ON `email_accounts` (`is_active`);--> statement-breakpoint
CREATE INDEX `email_accounts_default_idx` ON `email_accounts` (`is_default`);--> statement-breakpoint
CREATE TABLE `email_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`message_id` text NOT NULL,
	`from_addr` text NOT NULL,
	`subject` text NOT NULL,
	`body_preview` text,
	`email_date` integer,
	`headers` text,
	`status` text DEFAULT 'pending',
	`worker_id` text,
	`created_at` integer DEFAULT '"2026-01-08T02:23:53.385Z"',
	`started_at` integer,
	`completed_at` integer,
	`result` text,
	`error` text,
	FOREIGN KEY (`account_id`) REFERENCES `email_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_queue_account_id_idx` ON `email_queue` (`account_id`);--> statement-breakpoint
CREATE INDEX `email_queue_status_idx` ON `email_queue` (`status`);--> statement-breakpoint
CREATE INDEX `email_queue_worker_id_idx` ON `email_queue` (`worker_id`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`message_id` text NOT NULL,
	`from_addr` text NOT NULL,
	`subject` text NOT NULL,
	`body_preview` text,
	`date` integer,
	`classification` text DEFAULT 'unknown',
	`confidence` real DEFAULT 0,
	`processed_at` integer DEFAULT '"2026-01-08T02:23:53.384Z"',
	`deleted` integer DEFAULT 0,
	FOREIGN KEY (`account_id`) REFERENCES `email_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `emails_account_id_idx` ON `emails` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `emails_message_id_account_idx` ON `emails` (`message_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `emails_classification_idx` ON `emails` (`classification`);--> statement-breakpoint
CREATE INDEX `emails_date_idx` ON `emails` (`date`);--> statement-breakpoint
CREATE INDEX `emails_deleted_idx` ON `emails` (`deleted`);--> statement-breakpoint
CREATE TABLE `scan_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`started_at` integer DEFAULT '"2026-01-08T02:23:53.385Z"',
	`completed_at` integer,
	`emails_processed` integer DEFAULT 0,
	`spam_count` integer DEFAULT 0,
	`newsletter_count` integer DEFAULT 0,
	`keep_count` integer DEFAULT 0,
	FOREIGN KEY (`account_id`) REFERENCES `email_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scan_logs_account_id_idx` ON `scan_logs` (`account_id`);--> statement-breakpoint
CREATE INDEX `scan_logs_started_at_idx` ON `scan_logs` (`started_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT '"2026-01-08T02:23:53.385Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `unsubscribe_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_id` integer,
	`sender` text NOT NULL,
	`unsubscribe_url` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT '"2026-01-08T02:23:53.385Z"',
	`completed_at` integer,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE no action
);
