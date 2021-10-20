const iStore = {
  storeInstallation: async (installation) => {
    functions.logger.log('in store installataion TOP');
    // change the lines below so they save to your database
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      // support for org-wide app installation
      var companyRef = firestore.doc(`testInstall/${installation.enterprise.id}`);
      functions.logger.log('in store installataion', installation);
      return await companyRef.set(installation);
    }
    if (installation.team !== undefined) {
      // single team app installation
      companyRef = firestore.doc(`testInstall/${installation.team.id}`);
      functions.logger.log('in store installataion', installation);
      return await companyRef.set(installation);
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery) => {
    functions.logger.log('in fetch installataion TOP');
    // change the lines below so they fetch from your database
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // org wide app installation lookup
      var companyRef = firestore.doc(`testInstall/${installQuery.enterpriseId}`);
      functions.logger.log('in fetch installataion', installQuery);
      var companyDoc = await companyRef.get();
      return companyDoc.data();
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation lookup
      companyRef = firestore.doc(`testInstall/${installQuery.teamId}`);
      functions.logger.log('in fetch installataion', installQuery);
      companyDoc = await companyRef.get();
      return companyDoc.data();
    }
    throw new Error('Failed fetching installation');
  },
  deleteInstallation: async (installQuery) => {
    // change the lines below so they delete from your database
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // org wide app installation deletion
      // return await database.delete(installQuery.enterpriseId);
      return;
    }
    if (installQuery.teamId !== undefined) {
      // single team app installation deletion
      // return await database.delete(installQuery.teamId);
      return;
    }
    throw new Error('Failed to delete installation');
  },
};
