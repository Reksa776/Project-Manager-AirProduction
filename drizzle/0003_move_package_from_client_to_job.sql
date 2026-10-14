ALTER TABLE `clients` DROP FOREIGN KEY `clients_package_id_packages_id_fk`;
--> statement-breakpoint
ALTER TABLE `jobs` ADD `package_id` varchar(36);--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_package_id_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` DROP COLUMN `package_id`;